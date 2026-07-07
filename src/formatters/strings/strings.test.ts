import { describe, expect, it } from "vitest";

import { startsWithIgnoringZeros } from "./startsWithIgnoringZeros";
import { stripInnerSpaces } from "./stripInnerSpaces";
import { stripLeadingZeros } from "./stripLeadingZeros";
import { truncateText } from "./truncateText";

describe("strings helpers", () => {
	it("сравнивает префикс без учета ведущих нулей и регистра", () => {
		expect(startsWithIgnoringZeros("000ABC123", "0abc")).toBe(true);
		expect(startsWithIgnoringZeros("000ABC123", "bc")).toBe(false);
	});

	it("удаляет только внутренние пробелы, NBSP и узкие NBSP", () => {
		expect(stripInnerSpaces("12 34\u00a056\u202f78")).toBe("12345678");
		expect(stripInnerSpaces("1234")).toBe("1234");
	});

	it("удаляет ведущие нули только у числовых строк", () => {
		expect(stripLeadingZeros("00123")).toBe("123");
		expect(stripLeadingZeros("0000")).toBe("0");
		expect(stripLeadingZeros("-0012")).toBe("-12");
		expect(stripLeadingZeros("00A12")).toBe("00A12");
		expect(stripLeadingZeros("   ")).toBe("0");
	});

	it("обрезает нормализованный текст и не возвращает пустую строку", () => {
		expect(truncateText("  длинное значение  ", 7)).toBe("длинное...");
		expect(truncateText("коротко", 10)).toBe("коротко");
		expect(truncateText("   ", 10)).toBeUndefined();
	});
});
