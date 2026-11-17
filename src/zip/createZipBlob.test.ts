import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import { createDeferredPromise } from "../promise";

import { createZipBlob, type ZipFile } from "./index";

describe("createZipBlob", () => {
	it.each([undefined, "store", "deflate"] as const)("сохраняет имена и байты файлов, compression=%s", async (compression) => {
		const files: readonly ZipFile[] = [
			{ filename: "Отчёт №1 🗂.txt", blob: new Blob(["Проверка ZIP\n"], { type: "text/plain" }) },
			{ filename: "пустой.bin", blob: new Blob([]) },
			{ filename: "данные.bin", blob: new File([Uint8Array.of(0, 1, 127, 128, 255)], "исходное имя.bin") }
		];
		const archive = await createZipBlob(files, { compression });
		const bytes = new Uint8Array(await archive.arrayBuffer());
		const unpacked = unzipSync(bytes);

		expect(archive.type).toBe("application/zip");
		expect(Object.keys(unpacked)).toEqual(files.map(({ filename }) => filename));
		expect(new DataView(bytes.buffer).getUint16(8, true)).toBe(compression === "deflate" ? 8 : 0);
		for (const { blob, filename } of files) {
			expect(unpacked[filename]).toEqual(new Uint8Array(await blob.arrayBuffer()));
		}
	});

	it("создаёт корректный пустой архив", async () => {
		const archive = await createZipBlob([]);
		const bytes = new Uint8Array(await archive.arrayBuffer());

		expect(archive.size).toBe(22);
		expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x05, 0x06]);
		expect(unzipSync(bytes)).toEqual({});
	});

	it.each(["store", "deflate"] as const)("читает большой файл частями и сохраняет исходный Blob: %s", async (compression) => {
		const content = new TextEncoder().encode("Большой повторяющийся текст\n".repeat(12_000));
		const blob = new Blob([content]);
		const slice = vi.spyOn(blob, "slice");
		const archive = await createZipBlob([{ blob, filename: "большой.txt" }], { compression });
		const unpacked = unzipSync(new Uint8Array(await archive.arrayBuffer()));

		expect(slice.mock.calls.length).toBeGreaterThan(1);
		let previousEnd = 0;
		for (const [start, end] of slice.mock.calls) {
			expect(start).toBe(previousEnd);
			expect(end).toBeDefined();
			expect((end ?? 0) - (start ?? 0)).toBeLessThanOrEqual(64 * 1024);
			previousEnd = end ?? 0;
		}
		expect(previousEnd).toBe(blob.size);
		// Нативное побайтовое сравнение не обходит сотни тысяч свойств TypedArray
		// через deep equality и остаётся быстрым при полном параллельном прогоне.
		expect(Buffer.compare(unpacked["большой.txt"], content)).toBe(0);
		expect(Buffer.compare(new Uint8Array(await blob.arrayBuffer()), content)).toBe(0);
		if (compression === "deflate") expect(archive.size).toBeLessThan(blob.size / 10);
	});

	it("сохраняет точные имена, включая ключи прототипа и различающийся регистр", async () => {
		const filenames = ["__proto__", "constructor", "toString", "Файл.txt", "файл.txt", " пробелы .txt"];
		const archive = await createZipBlob(filenames.map((filename) => ({ filename, blob: new Blob([filename]) })));
		const names: string[] = [];
		unzipSync(new Uint8Array(await archive.arrayBuffer()), {
			filter: ({ name }) => {
				names.push(name);
				return false;
			}
		});

		expect(names).toEqual(filenames);
	});

	it.each([
		"",
		" \t",
		".",
		"..",
		"../file",
		"dir/file",
		"dir\\file",
		"C:file",
		"file\0.txt",
		"file\n.txt",
		"file\u007f",
		"file\u0085",
		"\ud800.txt",
		"\udc00.txt"
	])("отклоняет недопустимое имя до чтения: %j", async (filename) => {
		const blob = new Blob(["данные"]);
		const read = vi.spyOn(blob, "slice");

		await expect(
			createZipBlob([
				{ blob, filename: "корректный.txt" },
				{ blob, filename }
			])
		).rejects.toBeInstanceOf(TypeError);
		expect(read).not.toHaveBeenCalled();
	});

	it("отклоняет дубликаты до чтения первого файла", async () => {
		const blob = new Blob(["данные"]);
		const read = vi.spyOn(blob, "slice");

		await expect(
			createZipBlob([
				{ blob, filename: "один.txt" },
				{ blob, filename: "один.txt" }
			])
		).rejects.toThrow("Повторяющееся имя");
		expect(read).not.toHaveBeenCalled();
	});

	it("проверяет длину имени в UTF-8 байтах", async () => {
		const blob = new Blob([]);

		await expect(createZipBlob([{ blob, filename: "я".repeat(32_768) }])).rejects.toBeInstanceOf(RangeError);
		await expect(createZipBlob([{ blob, filename: "я".repeat(32_767) + "a" }])).resolves.toBeInstanceOf(Blob);
	});

	it("отклоняет количество и размеры, требующие ZIP64, без выделения больших буферов", async () => {
		const empty = new Blob([]);
		const large = new Blob([]);
		Object.defineProperty(large, "size", { value: 0xffffffff });
		const almostLarge = new Blob([]);
		Object.defineProperty(almostLarge, "size", { value: 0xffffffff - 100 });
		const read = vi.spyOn(almostLarge, "slice");

		await expect(createZipBlob(Array.from({ length: 0xffff }, () => ({ blob: empty, filename: "a" })))).rejects.toBeInstanceOf(
			RangeError
		);
		await expect(createZipBlob([{ blob: large, filename: "a" }], { compression: "deflate" })).rejects.toBeInstanceOf(RangeError);
		await expect(createZipBlob([{ blob: almostLarge, filename: "a" }])).rejects.toBeInstanceOf(RangeError);
		expect(read).not.toHaveBeenCalled();
	});

	it("фиксирует список и имена до первого await", async () => {
		const files = [
			{ blob: new Blob(["первый"]), filename: "первый.txt" },
			{ blob: new Blob(["второй"]), filename: "второй.txt" }
		];
		const result = createZipBlob(files);
		files[1].filename = "изменённый.txt";
		files[1].blob = new Blob(["изменённый"]);
		files.length = 0;

		const archive = await result;
		const unpacked = unzipSync(new Uint8Array(await archive.arrayBuffer()));
		expect(Object.keys(unpacked)).toEqual(["первый.txt", "второй.txt"]);
		expect(new TextDecoder().decode(unpacked["второй.txt"])).toBe("второй");
	});

	it("передаёт ошибку чтения и снимает abort listener", async () => {
		const reason = new Error("Носитель недоступен");
		const blob = new Blob(["данные"]);
		vi.spyOn(blob, "slice").mockImplementation(() => {
			throw reason;
		});
		const controller = new AbortController();
		const remove = vi.spyOn(controller.signal, "removeEventListener");

		await expect(createZipBlob([{ blob, filename: "a.txt" }], { signal: controller.signal })).rejects.toBe(reason);
		expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
	});

	it("передаёт асинхронную ошибку чтения", async () => {
		const reason = new Error("Ошибка чтения Blob");
		const blob = new Blob(["данные"]);
		const part = new Blob([]);
		vi.spyOn(blob, "slice").mockReturnValue(part);
		vi.spyOn(part, "arrayBuffer").mockRejectedValue(reason);

		await expect(createZipBlob([{ blob, filename: "a.txt" }])).rejects.toBe(reason);
	});

	it("не начинает чтение с уже отменённым signal", async () => {
		const blob = new Blob(["данные"]);
		const read = vi.spyOn(blob, "slice");
		const controller = new AbortController();
		controller.abort();

		await expect(createZipBlob([{ blob, filename: "a.txt" }], { signal: controller.signal })).rejects.toMatchObject({
			name: "AbortError"
		});
		expect(read).not.toHaveBeenCalled();
	});

	it.each([new Error("Отмена пользователем"), null])("отменяет ожидание чтения с исходной причиной %s", async (reason) => {
		const pendingRead = createDeferredPromise<ArrayBuffer>();
		const blob = new Blob(["данные"]);
		const part = new Blob([]);
		vi.spyOn(blob, "slice").mockReturnValue(part);
		vi.spyOn(part, "arrayBuffer").mockReturnValue(pendingRead.promise);
		const next = new Blob(["следующий"]);
		const readNext = vi.spyOn(next, "slice");
		const controller = new AbortController();
		const result = createZipBlob(
			[
				{ blob, filename: "a.txt" },
				{ blob: next, filename: "b.txt" }
			],
			{ signal: controller.signal }
		);

		controller.abort(reason);
		await expect(result).rejects.toBe(reason);
		pendingRead.resolve(new ArrayBuffer(0));
		await Promise.resolve();
		expect(readNext).not.toHaveBeenCalled();
	});

	it("снимает abort listener после успеха; поздняя отмена не меняет результат", async () => {
		const controller = new AbortController();
		const add = vi.spyOn(controller.signal, "addEventListener");
		const remove = vi.spyOn(controller.signal, "removeEventListener");
		const result = createZipBlob([], { signal: controller.signal });
		const archive = await result;
		controller.abort();

		expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
		await expect(result).resolves.toBe(archive);
	});
});
