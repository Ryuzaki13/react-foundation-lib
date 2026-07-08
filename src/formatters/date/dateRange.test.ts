import { describe, expect, it } from "vitest";

import { countCalendarDaysInDateRange, normalizeDateRange, requireDateRange } from "./index";

describe("normalizeDateRange", () => {
	it("преобразует одиночную дату в полный календарный день", () => {
		const value = new Date(2026, 2, 3, 18, 3, 50, 327);

		expect(normalizeDateRange(value)).toEqual([new Date(2026, 2, 3, 0, 0, 0, 0), new Date(2026, 2, 3, 23, 59, 59, 0)]);
	});

	it("упорядочивает пару дат и по умолчанию расширяет её до границ дней", () => {
		const start = new Date(2026, 2, 5, 18, 3, 50, 327);
		const end = new Date(2026, 2, 3, 5, 20, 10, 100);

		expect(normalizeDateRange([start, end])).toEqual([new Date(2026, 2, 3, 0, 0, 0, 0), new Date(2026, 2, 5, 23, 59, 59, 0)]);
	});

	it("сохраняет исходное время после упорядочивания в режиме preserve", () => {
		const start = new Date(2026, 2, 5, 18, 3, 50, 327);
		const end = new Date(2026, 2, 3, 5, 20, 10, 100);

		const normalized = normalizeDateRange([start, end], { timeMode: "preserve" });

		expect(normalized).toEqual([new Date(2026, 2, 3, 5, 20, 10, 100), new Date(2026, 2, 5, 18, 3, 50, 327)]);
		expect(normalized?.[0]).not.toBe(end);
		expect(normalized?.[1]).not.toBe(start);
	});

	it("использует заполненную границу как одиночную дату", () => {
		const value = new Date(2026, 2, 3, 18, 3, 50, 327);

		expect(normalizeDateRange([null, value])).toEqual([new Date(2026, 2, 3, 0, 0, 0, 0), new Date(2026, 2, 3, 23, 59, 59, 0)]);
	});

	it("возвращает null для пустого диапазона", () => {
		expect(normalizeDateRange(null)).toBeNull();
		expect(normalizeDateRange([null, null])).toBeNull();
		expect(normalizeDateRange(new Date(Number.NaN))).toBeNull();
	});
});

describe("requireDateRange", () => {
	it("возвращает нормализованный диапазон", () => {
		expect(requireDateRange(new Date(2026, 2, 3))).toEqual([new Date(2026, 2, 3, 0, 0, 0, 0), new Date(2026, 2, 3, 23, 59, 59, 0)]);
	});

	it("выбрасывает ошибку для пустого диапазона", () => {
		expect(() => requireDateRange(null)).toThrowError("Диапазон дат не задан");
	});
});

describe("countCalendarDaysInDateRange", () => {
	it("считает календарные дни включительно", () => {
		expect(countCalendarDaysInDateRange([new Date(2026, 2, 3, 18, 3), new Date(2026, 2, 5, 5, 20)])).toBe(3);
		expect(countCalendarDaysInDateRange(new Date(2026, 2, 3, 18, 3))).toBe(1);
	});

	it("упорядочивает границы и использует заполненную границу как одиночный день", () => {
		expect(countCalendarDaysInDateRange([new Date(2026, 2, 5), new Date(2026, 2, 3)])).toBe(3);
		expect(countCalendarDaysInDateRange([null, new Date(2026, 2, 3)])).toBe(1);
	});

	it("возвращает null для пустого диапазона", () => {
		expect(countCalendarDaysInDateRange([null, null])).toBeNull();
		expect(countCalendarDaysInDateRange(null)).toBeNull();
	});
});
