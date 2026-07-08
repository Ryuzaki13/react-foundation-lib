import { describe, expect, it } from "vitest";

import { formatFullName, formatShortName } from "./formatName";
import { clearPhone, formatPhone } from "./formatPhone";
import { normalizeLeadingZeros, normalizeLeadingZerosStrict } from "./normalizeLeadingZeros";

describe("formatName", () => {
	it("нормализует ФИО к полному виду", () => {
		expect(formatFullName("  иВАНОВ   иВАН   иВАНОВИЧ  ")).toBe("Иванов Иван Иванович");
		expect(formatFullName("петров")).toBe("Петров");
		expect(formatFullName("")).toBe("");
	});

	it("нормализует ФИО к короткому виду с инициалами", () => {
		expect(formatShortName("  иВАНОВ   иВАН   иВАНОВИЧ  ")).toBe("Иванов И.И.");
		expect(formatShortName("петров п.")).toBe("Петров П.");
		expect(formatShortName("")).toBe("");
	});
});

describe("formatPhone", () => {
	it("очищает телефон до российского формата +7", () => {
		expect(clearPhone("8 (912) 345-67-89")).toBe("+79123456789");
		expect(clearPhone("+7 912 345 67 89 доб. 42")).toBe("+79123456789");
	});

	it("форматирует только полный российский номер", () => {
		expect(formatPhone("89123456789")).toBe("+7 (912) 345-67-89");
		expect(formatPhone("123")).toBe("123");
	});
});

describe("normalizeLeadingZeros", () => {
	it("дополняет целую часть ведущими нулями без изменения дробной части", () => {
		expect(normalizeLeadingZeros(12.3, 4)).toBe("0012.3");
		expect(normalizeLeadingZeros("-7", 3)).toBe("-007");
	});

	it("возвращает исходное значение для нечислового ввода", () => {
		const value = { code: "001" };
		expect(normalizeLeadingZeros(value, 3)).toBe(value);
		expect(normalizeLeadingZeros("abc", 3)).toBe("abc");
	});

	it("строго удаляет или добавляет нули у строк с SAP-like группировкой", () => {
		expect(normalizeLeadingZerosStrict(" 001 234,50 ", -1)).toBe("1234,50");
		expect(normalizeLeadingZerosStrict("12", 4)).toBe("0012");
		expect(normalizeLeadingZerosStrict("abc", 4)).toBe("abc");
	});

	it("сохраняет number-тип в strict-режиме", () => {
		expect(normalizeLeadingZerosStrict(7, 3)).toBe(7);
		expect(normalizeLeadingZerosStrict(Number.NaN, 3)).toBeNaN();
	});
});
