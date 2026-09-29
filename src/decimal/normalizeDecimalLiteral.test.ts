import { describe, expect, it } from "vitest";

import { addDecimals, normalizeDecimal, normalizeDecimalLiteral } from "./index";

describe("Точная нормализация внешних числовых литералов", () => {
	it.each([
		["1e-1", "0.1"],
		["2E-1", "0.2"],
		["5.00e+2", "500"],
		["-0001.200e-1", "-0.12"],
		["0.000e9999999999999999999999", "0"],
		["9007199254740993e-1", "900719925474099.3"],
		["0.1234567890123456789", "0.1234567890123456789"],
		["12.0500e0", "12.05"]
	])("сохраняет %s как %s", (value, expected) => {
		expect(normalizeDecimalLiteral(value)).toBe(expected);
	});

	it("не переносит ошибку двоичного сложения в десятичный баланс", () => {
		expect(addDecimals(normalizeDecimalLiteral("1e-1"), normalizeDecimalLiteral("2e-1"))).toBe("0.3");
	});

	it("проверяет длину до разворачивания экспоненты", () => {
		expect(normalizeDecimalLiteral("1e-510")).toHaveLength(512);
		expect(() => normalizeDecimalLiteral("1e-511")).toThrow(RangeError);
		expect(() => normalizeDecimalLiteral("1e1000000000")).toThrow(RangeError);
		expect(() => normalizeDecimalLiteral("1e-1000000000")).toThrow(RangeError);
		expect(() => normalizeDecimalLiteral("1e9999999999999999999999")).toThrow(RangeError);
		expect(() => normalizeDecimalLiteral("9".repeat(513))).toThrow(TypeError);
		expect(() => normalizeDecimalLiteral("-1e2", { maxLength: 3 })).toThrow(TypeError);
	});

	it.each(["+1", "1,5", " 1", "1\n", "NaN", "Infinity", "1e", "1e1.5", ".5"])("отклоняет неверный литерал %s", (value) => {
		expect(() => normalizeDecimalLiteral(value)).toThrow(TypeError);
	});

	it("не меняет прежний строгий контракт normalizeDecimal", () => {
		expect(() => normalizeDecimal("1e-1")).toThrow(TypeError);
	});
});
