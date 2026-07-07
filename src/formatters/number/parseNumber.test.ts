import { describe, expect, it } from "vitest";

import { toPositiveInteger } from "./parseNumber";

describe("readPositiveInteger", () => {
	it("возвращает положительные целые числа", () => {
		expect(toPositiveInteger(1)).toBe(1);
		expect(toPositiveInteger("12")).toBe(12);
	});

	it("отклоняет ноль, отрицательные, дробные и нечисловые значения", () => {
		expect(toPositiveInteger(0)).toBeUndefined();
		expect(toPositiveInteger(-1)).toBeUndefined();
		expect(toPositiveInteger(1.5)).toBeUndefined();
		expect(toPositiveInteger("abc")).toBeUndefined();
		expect(toPositiveInteger(undefined)).toBeUndefined();
	});
});
