import { describe, expect, it } from "vitest";

import { checkFileSignature, type FileSignatureCheckResult } from "./index";

// Fixtures представляют headers из спецификаций, а не полноценные документы.
const ascii = (value: string): Uint8Array => new TextEncoder().encode(value);
const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const bitmap = Uint8Array.of(0x42, 0x4d, 14, 0, 0, 0, 0, 0, 0, 0, 14, 0, 0, 0);
const photoshop = Uint8Array.of(0x38, 0x42, 0x50, 0x53, 0, 1, 0, 0, 0, 0, 0, 0);
const rar4 = Uint8Array.of(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0);
const rar5 = Uint8Array.of(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 1, 0);
const zipLocal = new Uint8Array(30);
zipLocal.set([0x50, 0x4b, 0x03, 0x04]);
const zipEmpty = new Uint8Array(22);
zipEmpty.set([0x50, 0x4b, 0x05, 0x06]);
const sevenZip = new Uint8Array(32);
sevenZip.set([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4]);

const headers = [
	["png", png],
	["jpg", Uint8Array.of(0xff, 0xd8)],
	["jpeg", Uint8Array.of(0xff, 0xd8)],
	["bmp", bitmap],
	["psd", photoshop],
	["rtf", ascii("{\\rtf1\\ansi")],
	["rar", rar4],
	["rar", rar5],
	["zip", zipLocal],
	["zip", zipEmpty],
	["7z", sevenZip],
	["pdf", ascii("%PDF-1.7")]
] as const;

describe("checkFileSignature", () => {
	it.each(headers)("распознаёт поддержанный header %s", (extension, bytes) => {
		expect(checkFileSignature({ extension, bytes })).toBe("match");
	});

	it.each(headers)("читает только view с ненулевым offset: %s", (extension, bytes) => {
		const storage = new Uint8Array(bytes.length + 8).fill(0xaa);
		storage.set(bytes, 3);
		const view = storage.subarray(3, 3 + bytes.length);
		const before = storage.slice();
		expect(checkFileSignature({ extension, bytes: view })).toBe("match");
		expect(storage).toEqual(before);
	});

	it.each(headers)("не валидирует произвольный payload после header: %s", (extension, bytes) => {
		const content = new Uint8Array(bytes.length + 8).fill(0xff);
		content.set(bytes);
		expect(checkFileSignature({ extension, bytes: content })).toBe("match");
	});

	it.each([
		["png", png],
		["jpg", Uint8Array.of(0xff, 0xd8)],
		["bmp", bitmap],
		["psd", photoshop],
		["rar", rar4],
		["rar", rar5],
		["zip", zipLocal],
		["zip", zipEmpty],
		["7z", sevenZip],
		["pdf", ascii("%PDF-1.7")],
		["rtf", ascii("{\\rtf1\\")]
	] as const)("отклоняет все усечения известного header: %s", (extension, bytes) => {
		for (let size = 0; size < bytes.length; size += 1) {
			expect(checkFileSignature({ extension, bytes: bytes.subarray(0, size) }), `header ${extension}, bytes=${size}`).toBe(
				"mismatch"
			);
		}
	});

	it.each([
		["png", Uint8Array.of(0, ...png.subarray(1))],
		["jpg", Uint8Array.of(0xff, 0xd9)],
		["bmp", Uint8Array.of(...bitmap.subarray(0, 6), 1, ...bitmap.subarray(7))],
		["psd", Uint8Array.of(...photoshop.subarray(0, 11), 1)],
		["rar", Uint8Array.of(...rar4.subarray(0, 4), 0, ...rar4.subarray(5))],
		["rar", Uint8Array.of(...rar5.subarray(0, 7), 1)],
		["zip", Uint8Array.of(...zipLocal.subarray(0, 3), 0, ...zipLocal.subarray(4))],
		["7z", Uint8Array.of(...sevenZip.subarray(0, 2), 0, ...sevenZip.subarray(3))],
		["rtf", ascii("{\\rtf1abc")],
		["rtf", ascii("{\\rtf10\\ansi")],
		["pdf", ascii("%PDF_1.7")],
		["pdf", ascii("%PDF-1.X")]
	] as const)("не прячет повреждение поддержанного header %s за unsupported", (extension, bytes) => {
		expect(checkFileSignature({ extension, bytes })).toBe("mismatch");
	});

	it.each([0xe0, 0xe1, 0xdb, 0xc2])("не ограничивает JPEG конкретным APP/JFIF/Exif marker: %s", (marker) => {
		expect(checkFileSignature({ extension: "jpeg", bytes: Uint8Array.of(0xff, 0xd8, 0xff, marker) })).toBe("match");
	});

	it("принимает JPEG fill bytes и останавливает длинный prefix", () => {
		expect(checkFileSignature({ extension: "jpg", bytes: Uint8Array.of(0xff, 0xff, 0xd8) })).toBe("match");
		expect(checkFileSignature({ extension: "jpg", bytes: new Uint8Array(100_000).fill(0xff) })).toBe("unsupported");
	});

	it.each([12, 40, 108, 124])("не ограничивает BMP одной версией DIB: %s", (dibSize) => {
		const bytes = new Uint8Array(18);
		bytes.set(bitmap);
		bytes[14] = dibSize;
		expect(checkFileSignature({ extension: "bmp", bytes })).toBe("match");
	});

	it.each([
		["psd", Uint8Array.of(0x38, 0x42, 0x50, 0x53, 0, 2)],
		["psd", Uint8Array.of(0x38, 0x42, 0x50, 0x53, 0, 3)],
		["rar", Uint8Array.of(...rar5.subarray(0, 6), 2)],
		["7z", Uint8Array.of(...sevenZip.subarray(0, 6), 1, 0)],
		["pdf", ascii("%PDF-3.0")],
		["bmp", ascii("BAalternative")],
		["bmp", Uint8Array.of(40, 0, 0, 0)],
		["rtf", ascii("\uFEFF{\\rtf1\\ansi")],
		["zip", Uint8Array.of(0x50, 0x4b, 0x07, 0x08)],
		["zip", Uint8Array.of(0x50, 0x4b, 0x30, 0x30)]
	] as const)("сохраняет неподдержанный вариант %s", (extension, bytes) => {
		expect(checkFileSignature({ extension, bytes })).toBe("unsupported");
	});

	it.each(["rar", "zip", "7z"])("не принимает или запрещает SFX по вложенному marker: %s", (extension) => {
		const bytes = new Uint8Array(100);
		bytes.set(ascii("MZ"));
		bytes.set(extension === "rar" ? rar5 : extension === "zip" ? zipLocal : sevenZip, 30);
		expect(checkFileSignature({ extension, bytes })).toBe("unsupported");
		expect(checkFileSignature({ extension, bytes: ascii("unknown representation") })).toBe("unsupported");
	});

	it("не считает новый minor 7z запретом версии", () => {
		const bytes = sevenZip.slice();
		bytes[7] = 99;
		expect(checkFileSignature({ extension: "7z", bytes })).toBe("match");
	});

	it.each([0, 17, 1016])("распознаёт PDF header внутри scan с offset %s", (offset) => {
		const bytes = new Uint8Array(offset + 8).fill(0xaa);
		bytes.set(ascii("%PDF-2.0"), offset);
		expect(checkFileSignature({ extension: "pdf", bytes })).toBe("match");
	});

	it("различает EOF и пересечение границы PDF scan", () => {
		const complete = new Uint8Array(1040);
		complete.set(ascii("%PDF-1.7"), 1020);
		expect(checkFileSignature({ extension: "pdf", bytes: complete })).toBe("unsupported");
		expect(checkFileSignature({ extension: "pdf", bytes: complete.subarray(0, 1024) })).toBe("mismatch");
		complete.set(ascii("%PDF-1.7"), 1024);
		expect(checkFileSignature({ extension: "pdf", bytes: complete })).toBe("unsupported");
	});

	it("не использует подходящую сигнатуру за пределами переданного view", () => {
		const backing = new Uint8Array(40);
		backing.set(png);
		expect(checkFileSignature({ extension: "png", bytes: backing.subarray(8, 16) })).toBe("mismatch");
		expect(checkFileSignature({ extension: "png", bytes: backing.subarray(0, 7) })).toBe("mismatch");
	});

	it("не запрещает альтернативный PDF header и не принимает его за match", () => {
		expect(checkFileSignature({ extension: "pdf", bytes: ascii("%!PS-Adobe-3.0 PDF-1.4") })).toBe("unsupported");
		expect(checkFileSignature({ extension: "pdf", bytes: ascii("unknown representation") })).toBe("unsupported");
		expect(checkFileSignature({ extension: "pdf", bytes: ascii("%PDF-1.X\n%PDF-1.7") })).toBe("match");
	});

	it.each([
		"doc",
		"ppt",
		"xls",
		"dot",
		"docx",
		"pptx",
		"xlsx",
		"docm",
		"odt",
		"fla",
		"ai",
		"txt",
		"bak",
		"cdr",
		"tga",
		"dt",
		"mdb",
		"accdb",
		"erwin"
	])("не выдаёт контейнер за проверку формата %s", (extension) => {
		for (const bytes of [zipLocal, Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), png, new Uint8Array()]) {
			expect(checkFileSignature({ extension, bytes })).toBe("unsupported");
		}
	});

	it("нормализует только extension token, не вводя filename/allowlist policy", () => {
		expect(checkFileSignature({ extension: " PNG ", bytes: png })).toBe("match");
		for (const extension of [".png", "image.png", "", "unknown", "gif"]) {
			const result: FileSignatureCheckResult = checkFileSignature({ extension, bytes: png });
			expect(result).toBe("unsupported");
		}
	});
});
