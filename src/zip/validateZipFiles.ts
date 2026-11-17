import {
	ZIP_CENTRAL_DIRECTORY_ENTRY_BYTES,
	ZIP_COMPRESSION_STORE,
	ZIP_END_RECORD_BYTES,
	ZIP_ENTRY_OVERHEAD_BYTES,
	ZIP_FILENAME_MAX_BYTES,
	ZIP64_ARCHIVE_SIZE_MESSAGE,
	ZIP64_ENTRY_COUNT_MARKER,
	ZIP64_SIZE_MARKER
} from "./zipConstants";
import { type CreateZipBlobOptions, type ZipFile } from "./zipTypes";

// В unicode-режиме диапазон суррогатов запрещает только непарные UTF-16 code units.
const INVALID_ZIP_FILENAME_CHARACTERS = /[/\\:\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u;

type ValidatedZipFiles = {
	readonly entries: ZipFile[];
	readonly footerBytes: number;
};

/** Проверяет метаданные до чтения и фиксирует состав архива на момент вызова. */
export function validateZipFiles(files: readonly ZipFile[], compression: CreateZipBlobOptions["compression"]): ValidatedZipFiles {
	if (files.length >= ZIP64_ENTRY_COUNT_MARKER) {
		throw new RangeError("Количество файлов требует ZIP64, который не поддерживается");
	}

	const encoder = new TextEncoder();
	const names = new Set<string>();
	const entries: ZipFile[] = [];
	let archiveBytes = ZIP_END_RECORD_BYTES;
	let footerBytes = ZIP_END_RECORD_BYTES;

	for (const { blob, filename } of files) {
		if (!filename.trim() || filename === "." || filename === ".." || INVALID_ZIP_FILENAME_CHARACTERS.test(filename)) {
			throw new TypeError("ZIP ожидает непустое имя файла без пути, двоеточия и управляющих символов");
		}
		if (names.has(filename)) {
			throw new TypeError(`Повторяющееся имя файла в ZIP: ${filename}`);
		}

		const nameBytes = encoder.encode(filename).byteLength;
		if (nameBytes > ZIP_FILENAME_MAX_BYTES) {
			throw new RangeError("Имя файла в ZIP превышает 65535 байт UTF-8");
		}
		if (blob.size >= ZIP64_SIZE_MARKER) {
			throw new RangeError("Размер файла требует ZIP64, который не поддерживается");
		}

		// Имя присутствует и в local header, и в central directory. Для DEFLATE
		// размер содержимого проверяется по выходным частям во время упаковки.
		archiveBytes += ZIP_ENTRY_OVERHEAD_BYTES + 2 * nameBytes;
		footerBytes += ZIP_CENTRAL_DIRECTORY_ENTRY_BYTES + nameBytes;
		if (compression === ZIP_COMPRESSION_STORE) archiveBytes += blob.size;
		if (archiveBytes >= ZIP64_SIZE_MARKER) {
			throw new RangeError(ZIP64_ARCHIVE_SIZE_MESSAGE);
		}

		names.add(filename);
		entries.push({ blob, filename });
	}

	return { entries, footerBytes };
}
