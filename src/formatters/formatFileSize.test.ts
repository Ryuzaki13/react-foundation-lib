import { describe, expect, it } from "vitest";

import { formatFileSize } from "./formatFileSize";

describe("formatFileSize", () => {
	it.each([
		[0, "0 Б"],
		[1, "1 Б"],
		[1023, "1 023 Б"],
		[1024, "1 КиБ"],
		[1536, "1,5 КиБ"],
		[2049, "2 КиБ"],
		[1024 ** 2, "1 МиБ"],
		[200 * 1024 ** 2, "200 МиБ"],
		[1024 ** 3, "1 ГиБ"],
		[1024 ** 4, "1 ТиБ"],
		[1024 ** 5, "1 ПиБ"]
	])("форматирует %s байт", (bytes, expected) => {
		expect(formatFileSize(bytes)).toBe(expected);
	});
	it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("не выдаёт некорректный размер %s за ноль", (bytes) => {
		expect(() => formatFileSize(bytes)).toThrow(RangeError);
	});
});
