import { Zip } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeferredPromise, type DeferredPromise } from "../promise";

import { createZipBlob } from "./index";

type CompressionProbe = {
	readonly writes: DeferredPromise<void>[];
	readonly output: DeferredPromise<ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>>;
	readonly close: ReturnType<typeof vi.fn<() => Promise<void>>>;
	readonly cancel: ReturnType<typeof vi.fn<() => void>>;
};

const compressors: CompressionProbe[] = [];

beforeEach(() => {
	// ZIP writer и Web Streams настоящие. Управляется только компрессор:
	// его задержки и ошибки воспроизводимы без зависимости от скорости устройства.
	vi.stubGlobal(
		"CompressionStream",
		class {
			readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
			readonly writable: WritableStream<BufferSource>;

			constructor(format: string) {
				expect(format).toBe("deflate-raw");
				const output = createDeferredPromise<ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>>();
				const writes: DeferredPromise<void>[] = [];
				const close = vi.fn(async () => (await output.promise).close());
				const cancel = vi.fn();
				compressors.push({ output, writes, close, cancel });

				this.readable = new ReadableStream({ start: output.resolve, cancel });
				this.writable = new WritableStream({
					write: () => {
						const completion = createDeferredPromise<void>();
						writes.push(completion);
						return completion.promise;
					},
					close
				});
			}
		}
	);
});

afterEach(() => {
	for (const compressor of compressors) {
		for (const write of compressor.writes) write.resolve();
	}
	compressors.length = 0;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("createZipBlob: lifecycle", () => {
	it("ждёт принятия каждой части и завершения выхода до следующего файла", async () => {
		const first = new Blob([new Uint8Array(128 * 1024)]);
		const next = new Blob(["следующий"]);
		const readFirst = vi.spyOn(first, "slice");
		const readNext = vi.spyOn(next, "slice");
		const controller = new AbortController();
		const result = createZipBlob(
			[
				{ blob: first, filename: "a.bin" },
				{ blob: next, filename: "b.txt" }
			],
			{
				compression: "deflate",
				signal: controller.signal
			}
		);

		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(1));
		expect(readFirst).toHaveBeenCalledTimes(1);
		expect(readNext).not.toHaveBeenCalled();
		expect(compressors).toHaveLength(1);

		// Промежуточный output не разрешает читать следующую входную часть.
		(await compressors[0].output.promise).enqueue(new Uint8Array());
		await Promise.resolve();
		expect(readFirst).toHaveBeenCalledTimes(1);

		compressors[0].writes[0].resolve();
		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(2));
		expect(readFirst).toHaveBeenCalledTimes(2);
		expect(readNext).not.toHaveBeenCalled();

		compressors[0].writes[1].resolve();
		await vi.waitFor(() => expect(compressors).toHaveLength(2));
		expect(compressors[0].close).toHaveBeenCalledOnce();
		expect(readNext).toHaveBeenCalledTimes(1);

		controller.abort();
		await expect(result).rejects.toMatchObject({ name: "AbortError" });
		await vi.waitFor(() => expect(compressors[1].cancel).toHaveBeenCalledOnce());
	});

	it("отменяет pending write, снимает listener и не возобновляет чтение", async () => {
		const reason = new Error("Пользователь закрыл сценарий");
		const blob = new Blob([new Uint8Array(128 * 1024)]);
		const read = vi.spyOn(blob, "slice");
		const controller = new AbortController();
		const remove = vi.spyOn(controller.signal, "removeEventListener");
		const result = createZipBlob([{ blob, filename: "a.bin" }], { compression: "deflate", signal: controller.signal });
		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(1));

		controller.abort(reason);
		await expect(result).rejects.toBe(reason);
		await vi.waitFor(() => expect(compressors[0].cancel).toHaveBeenCalledOnce());
		expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));

		compressors[0].writes[0].resolve();
		await Promise.resolve();
		expect(read).toHaveBeenCalledOnce();
		await expect(result).rejects.toBe(reason);
	});

	it("передаёт ошибку входного потока и прекращает чтение", async () => {
		const reason = new Error("Компрессор отказал");
		const blob = new Blob([new Uint8Array(128 * 1024)]);
		const read = vi.spyOn(blob, "slice");
		const result = createZipBlob([{ blob, filename: "a.bin" }], { compression: "deflate" });
		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(1));

		compressors[0].writes[0].reject(reason);
		await expect(result).rejects.toBe(reason);
		await vi.waitFor(() => expect(compressors[0].cancel).toHaveBeenCalledOnce());
		expect(read).toHaveBeenCalledOnce();
	});

	it("передаёт ошибку выходного потока, даже когда входной write ещё ожидает", async () => {
		const reason = new Error("Ошибка выхода компрессора");
		const result = createZipBlob([{ blob: new Blob(["данные"]), filename: "a.txt" }], { compression: "deflate" });
		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(1));

		(await compressors[0].output.promise).error(reason);
		await expect(result).rejects.toBe(reason);
	});

	it("отклоняет deflate без CompressionStream; store остаётся доступен", async () => {
		vi.stubGlobal("CompressionStream", undefined);
		const blob = new Blob(["данные"]);
		const read = vi.spyOn(blob, "slice");

		await expect(createZipBlob([{ blob, filename: "a.txt" }], { compression: "deflate" })).rejects.toThrow("CompressionStream");
		expect(read).not.toHaveBeenCalled();
		await expect(createZipBlob([{ blob, filename: "a.txt" }])).resolves.toBeInstanceOf(Blob);
	});

	it("передаёт отказ создания deflate-raw без чтения и fallback", async () => {
		const reason = new TypeError("Формат не поддерживается");
		vi.stubGlobal(
			"CompressionStream",
			class {
				constructor() {
					throw reason;
				}
			}
		);
		const blob = new Blob(["данные"]);
		const read = vi.spyOn(blob, "slice");

		await expect(createZipBlob([{ blob, filename: "a.txt" }], { compression: "deflate" })).rejects.toBe(reason);
		expect(read).not.toHaveBeenCalled();
	});

	it("останавливает архив при переполнении выходного размера", async () => {
		const result = createZipBlob([{ blob: new Blob(["данные"]), filename: "a.txt" }], { compression: "deflate" });
		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(1));
		const oversizedOutput = new Uint8Array();
		Object.defineProperty(oversizedOutput, "byteLength", { value: 0xffffffff });

		(await compressors[0].output.promise).enqueue(oversizedOutput);
		await expect(result).rejects.toBeInstanceOf(RangeError);
		await vi.waitFor(() => expect(compressors[0].cancel).toHaveBeenCalledOnce());
	});

	it("резервирует central directory до её выделения и завершения компрессора", async () => {
		const end = vi.spyOn(Zip.prototype, "end");
		const result = createZipBlob([{ blob: new Blob(["данные"]), filename: "a" }], { compression: "deflate" });
		await vi.waitFor(() => expect(compressors[0].writes).toHaveLength(1));

		// Вместе с local header (31 байт) output ещё помещается в обычный ZIP,
		// но central directory и EOCD (69 байт) уже переполнят его. Виртуальный
		// размер воспроизводит границу без выделения многогигабайтного буфера.
		const output = new Uint8Array();
		Object.defineProperty(output, "byteLength", { value: 0xffffffff - 80 });
		(await compressors[0].output.promise).enqueue(output);

		await expect(result).rejects.toBeInstanceOf(RangeError);
		expect(end).not.toHaveBeenCalled();
		expect(compressors[0].close).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(compressors[0].cancel).toHaveBeenCalledOnce());
	});

	it("отменяет уступку event loop и удаляет её таймер", async () => {
		vi.useFakeTimers();
		let time = 0;
		vi.spyOn(performance, "now").mockImplementation(() => (time += 10));
		const blob = new Blob(["данные"]);
		const read = vi.spyOn(blob, "slice");
		const controller = new AbortController();
		const result = createZipBlob([{ blob, filename: "a.txt" }], { signal: controller.signal });
		expect(vi.getTimerCount()).toBe(1);

		controller.abort();
		await expect(result).rejects.toMatchObject({ name: "AbortError" });
		expect(vi.getTimerCount()).toBe(0);
		expect(read).not.toHaveBeenCalled();
	});

	it("снимает listener и отменяет поток при отказе archive.add", async () => {
		vi.useFakeTimers();
		// fflate не может записать DOS timestamp за пределами 1980–2099.
		vi.setSystemTime(new Date(2100, 0, 1));
		const controller = new AbortController();
		const remove = vi.spyOn(controller.signal, "removeEventListener");

		await expect(
			createZipBlob([{ blob: new Blob([]), filename: "a.txt" }], { compression: "deflate", signal: controller.signal })
		).rejects.toBeInstanceOf(Error);
		expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
		vi.useRealTimers();
		await vi.waitFor(() => expect(compressors[0].cancel).toHaveBeenCalledOnce());
	});
});
