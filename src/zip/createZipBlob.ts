import { Zip, ZipPassThrough } from "fflate";

import { createDeferredPromise } from "../promise";

import { validateZipFiles } from "./validateZipFiles";
import {
	ZIP_COMPRESSION_DEFLATE,
	ZIP_COMPRESSION_STORE,
	ZIP_MAIN_THREAD_BUDGET_MS,
	ZIP_MIME_TYPE,
	ZIP_READ_CHUNK_BYTES,
	ZIP64_ARCHIVE_SIZE_MESSAGE,
	ZIP64_SIZE_MARKER
} from "./zipConstants";
import { ZipDeflateStream } from "./ZipDeflateStream";
import { type CreateZipBlobOptions, type ZipFile } from "./zipTypes";

/**
 * Собирает ZIP из готовых Blob без сетевых запросов и скачивания. Файлы читаются
 * последовательно; сжатие использует один нативный поток с ограниченной подачей входа.
 * Итоговый Blob и накопленные выходные части требуют памяти под весь архив.
 */
export async function createZipBlob(files: readonly ZipFile[], options: CreateZipBlobOptions = {}): Promise<Blob> {
	const { compression = ZIP_COMPRESSION_STORE, signal } = options;
	signal?.throwIfAborted();
	if (compression !== ZIP_COMPRESSION_STORE && compression !== ZIP_COMPRESSION_DEFLATE) {
		throw new TypeError("Неизвестный режим сжатия ZIP");
	}

	const { entries, footerBytes } = validateZipFiles(files, compression);
	// Собственная очередь освобождает обработанные Blob без сдвига всего массива.
	entries.reverse();

	const completion = createDeferredPromise<Blob>();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let settled = false;
	let outputBytes = 0;
	let archive: Zip | undefined;
	let activeFile: ZipPassThrough | ZipDeflateStream | undefined;
	let activeBlob: Blob | undefined;
	let yieldTimer: ReturnType<typeof setTimeout> | undefined;
	let resumeYield: (() => void) | undefined;

	const cleanup = () => {
		signal?.removeEventListener("abort", onAbort);
		clearTimeout(yieldTimer);
		resumeYield?.();
		resumeYield = undefined;

		// Незавершённое arrayBuffer может удерживать async frame сколь угодно долго.
		// Ссылки на исходные Blob и ZIP writer не должны переживать отмену в этом frame.
		entries.length = 0;
		activeBlob = undefined;
		if (activeFile) activeFile.ondata = () => undefined;
		// Поток может быть создан до неудачного archive.add().
		if (activeFile instanceof ZipDeflateStream) activeFile.terminate();
		activeFile = undefined;
		archive?.terminate();
		archive = undefined;
		chunks.length = 0;
	};

	const fail = (error: unknown) => {
		if (settled) return;

		settled = true;
		cleanup();
		completion.reject(error);
	};
	const onAbort = () => fail(signal?.reason);

	archive = new Zip((error, chunk, final) => {
		if (settled) return;
		if (error) {
			fail(error);
			return;
		}

		try {
			outputBytes += chunk.byteLength;
			// fflate выделяет central directory целиком внутри end(). Резервируем
			// её заранее, чтобы превышение лимита обнаружилось до этого выделения.
			if (outputBytes + (final ? 0 : footerBytes) >= ZIP64_SIZE_MARKER) {
				throw new RangeError(ZIP64_ARCHIVE_SIZE_MESSAGE);
			}

			chunks.push(chunk);

			if (final) {
				const blob = new Blob(chunks, { type: ZIP_MIME_TYPE });
				settled = true;
				cleanup();
				completion.resolve(blob);
			}
		} catch (error) {
			fail(error);
		}
	});

	const writeFiles = async () => {
		let yieldDeadline = performance.now() + ZIP_MAIN_THREAD_BUDGET_MS;
		let entry = entries.pop();

		while (entry) {
			if (settled || !archive) return;

			activeBlob = entry.blob;
			const { filename } = entry;
			const fileSize = activeBlob.size;
			// Через await сохраняется только очищаемая ссылка activeBlob.
			entry = undefined;

			const file = compression === ZIP_COMPRESSION_DEFLATE ? new ZipDeflateStream(filename, fail) : new ZipPassThrough(filename);
			activeFile = file;
			archive.add(file);
			let offset = 0;

			// do/while сохраняет пустой файл как полноценную запись ZIP.
			do {
				// Даже store считает CRC на основном потоке. Macrotask даёт браузеру
				// возможность обработать пользовательскую отмену и перерисовать UI.
				if (performance.now() >= yieldDeadline) {
					await new Promise<void>((resolve) => {
						resumeYield = resolve;
						yieldTimer = setTimeout(resolve, 0);
					});
					resumeYield = undefined;
					yieldTimer = undefined;
					yieldDeadline = performance.now() + ZIP_MAIN_THREAD_BUDGET_MS;
				}
				if (settled || !activeBlob) return;

				const end = Math.min(offset + ZIP_READ_CHUNK_BYTES, fileSize);
				const chunk = new Uint8Array(await activeBlob.slice(offset, end).arrayBuffer());
				// Blob.arrayBuffer нельзя отменить; поздний результат уже начатого
				// ограниченного чтения не должен возобновить отменённую упаковку.
				if (settled) return;

				const final = end === fileSize;
				if (file instanceof ZipDeflateStream) await file.write(chunk, final);
				else file.push(chunk, final);
				offset = end;
			} while (!settled && offset < fileSize);

			activeFile = undefined;
			activeBlob = undefined;
			entry = entries.pop();
		}

		if (!settled) archive?.end();
	};

	signal?.addEventListener("abort", onAbort, { once: true });
	void writeFiles().catch(fail);

	return completion.promise;
}
