// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { binaryToBlob, detectMimeType } from "./binaryToBlob";

const toBase64 = (value: string): string => btoa(value);

const bytesToBase64 = (bytes: number[]): string => btoa(String.fromCharCode(...bytes));

describe("binaryToBlob", () => {
	it("создаёт Blob из base64-строки", async () => {
		const blob = binaryToBlob(toBase64("test"), "text/plain");

		expect(blob.type).toBe("text/plain");
		expect(await blob.text()).toBe("test");
	});

	it("добавляет недостающий padding и поддерживает url-safe base64", async () => {
		const blob = binaryToBlob("__8", "application/octet-stream");
		const bytes = [...new Uint8Array(await blob.arrayBuffer())];

		expect(bytes).toEqual([255, 255]);
	});

	it("создаёт Blob из бинарной строки без base64-декодирования", async () => {
		const blob = binaryToBlob("ABC", "text/plain", false);

		expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([65, 66, 67]);
	});

	it("поддерживает data URL и пустой MIME-тип", async () => {
		const blob = binaryToBlob(`data:text/plain;base64,${toBase64("file")}`, "");

		expect(blob.type).toBe("application/octet-stream");
		expect(await blob.text()).toBe("file");
	});

	it("отклоняет пустые входные данные и data URL без payload", () => {
		expect(() => binaryToBlob("", "text/plain")).toThrow("Не переданы бинарные данные");
		expect(() => binaryToBlob("data:text/plain;base64,", "text/plain")).toThrow("После преобразования не осталось данных");
	});

	it("сообщает об ошибке для некорректного base64", () => {
		expect(() => binaryToBlob("not valid *", "text/plain")).toThrow("Некорректный формат base64");
		expect(() => binaryToBlob("abcde", "text/plain")).toThrow("Некорректный формат base64");
	});
});

describe("detectMimeType", () => {
	it("определяет MIME-тип по расширению файла", () => {
		expect(detectMimeType("report.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		expect(detectMimeType("photo.JPG")).toBe("image/jpeg");
	});

	it("определяет MIME-тип по data URL", () => {
		expect(detectMimeType(undefined, `data:image/png;base64,${bytesToBase64([0x89, 0x50, 0x4e, 0x47])}`)).toBe("image/png");
	});

	it("определяет MIME-тип по сигнатурам base64-данных", () => {
		expect(detectMimeType(undefined, toBase64("%PDF-1.7"))).toBe("application/pdf");
		expect(detectMimeType(undefined, bytesToBase64([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
		expect(detectMimeType(undefined, bytesToBase64([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
		expect(detectMimeType(undefined, toBase64("GIF89a"))).toBe("image/gif");
		expect(detectMimeType(undefined, toBase64("RIFFxxxxWEBP"))).toBe("image/webp");
		expect(detectMimeType(undefined, bytesToBase64([0x50, 0x4b, 0x03, 0x04]))).toBe("application/zip");
		expect(detectMimeType(undefined, toBase64('  <?xml version="1.0"?>'))).toBe("application/xml");
		expect(detectMimeType(undefined, toBase64("<root />"))).toBe("application/xml");
	});

	it("использует сигнатуру, если data URL не содержит MIME-тип", () => {
		expect(detectMimeType(undefined, `data:;base64,${toBase64("%PDF-1.7")}`)).toBe("application/pdf");
	});

	it("возвращает PDF для неизвестного типа документа", () => {
		expect(detectMimeType(undefined, "не base64")).toBe("application/pdf");
	});
});
