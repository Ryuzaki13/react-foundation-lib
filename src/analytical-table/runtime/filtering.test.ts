import { describe, expect, it } from "vitest";

import { matchesAnalyticalFilter } from "./filtering";

describe("аналитические фильтры", () => {
	it.each([
		["contains", "АЛ", true],
		["startsWith", "А", true],
		["equals", "Альфа", true],
		["notEquals", "Бета", true],
		["in", ["Бета", "Альфа"], true],
		["empty", undefined, false]
	] as const)("%s применяет единую семантику текста", (operator, value, expected) => {
		expect(matchesAnalyticalFilter({ id: "r", values: { name: "Альфа" } }, { id: "name", operator, value })).toBe(expected);
	});
	it.each([
		["between", [2, 6]],
		["gt", 4],
		["gte", 5],
		["lt", 6],
		["lte", 5]
	] as const)("%s сравнивает числа без строкового порядка", (operator, value) => {
		expect(matchesAnalyticalFilter({ id: "r", values: { amount: 5 } }, { id: "amount", operator, value })).toBe(true);
		expect(matchesAnalyticalFilter({ id: "r", values: { amount: null } }, { id: "amount", operator, value })).toBe(false);
	});
});
