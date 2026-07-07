import { describe, expect, it } from "vitest";

import {
	normalizeRequiredText,
	normalizeText,
	normalizeTextSpaces,
	normalizeTextToLower,
	normalizeTextWithFallback,
	toSafeString
} from "./normalizeText";

describe("normalizeText", () => {
	it("возвращает обрезанную непустую строку", () => {
		expect(normalizeText("  Документ  ")).toBe("Документ");
	});

	it("отсекает пустые строки и нестроковые значения", () => {
		expect(normalizeText("   ")).toBeUndefined();
		expect(normalizeText(123)).toBeUndefined();
		expect(normalizeText(null)).toBeUndefined();
	});

	it("подставляет fallback только для невалидного текста", () => {
		expect(normalizeTextWithFallback("  Значение  ", "fallback")).toBe("Значение");
		expect(normalizeTextWithFallback(undefined, "fallback")).toBe("fallback");
		expect(normalizeRequiredText(undefined)).toBe("");
	});

	it("нормализует регистр только после базовой проверки текста", () => {
		expect(normalizeTextToLower("  ПоИск  ")).toBe("поиск");
		expect(normalizeTextToLower(false)).toBe("");
	});

	it("безопасно приводит значения к строке", () => {
		expect(toSafeString(null)).toBe("");
		expect(toSafeString(undefined)).toBe("");
		expect(toSafeString(0)).toBe("0");
	});
});

describe("normalizeTextSpaces", () => {
	it("обрезает пробелы по краям строки", () => {
		expect(normalizeTextSpaces("  Название документа  ")).toBe("Название документа");
	});

	it("сворачивает несколько обычных пробелов подряд", () => {
		expect(normalizeTextSpaces("Название   важного    документа")).toBe("Название важного документа");
	});

	it("сворачивает табы, переносы строк и неразрывные пробелы", () => {
		expect(normalizeTextSpaces("Название\tважного\n\u00a0документа")).toBe("Название важного документа");
	});
});
