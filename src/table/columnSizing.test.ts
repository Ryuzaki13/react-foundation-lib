import { describe, expect, it } from "vitest";

import {
	DEFAULT_TABLE_COLUMN_MIN_WIDTH,
	DEFAULT_TABLE_COLUMN_MIN_WIDTH_EM,
	normalizeTableColumnSizing,
	normalizeTableColumnWidth,
	patchTableColumnWidth,
	removeTableColumnWidth
} from "./columnSizing";

describe("table column sizing", () => {
	it("нормализует ширину с нижней границей", () => {
		expect(normalizeTableColumnWidth(125.8)).toBe(125);
		expect(normalizeTableColumnWidth(12)).toBe(DEFAULT_TABLE_COLUMN_MIN_WIDTH);
		expect(normalizeTableColumnWidth(Number.NaN, 80)).toBe(80);
	});

	it("очищает некорректные значения state", () => {
		expect(
			normalizeTableColumnSizing({
				A: 120.7,
				B: Number.NaN,
				"": 90,
				C: 10
			})
		).toEqual({
			A: 120,
			C: DEFAULT_TABLE_COLUMN_MIN_WIDTH
		});
	});

	it("добавляет и удаляет ширину колонки", () => {
		const patched = patchTableColumnWidth({ A: 120 }, "B", 96);

		expect(patched).toEqual({ A: 120, B: 96 });
		expect(removeTableColumnWidth(patched, "A")).toEqual({ B: 96 });
	});

	it("сохраняет дробные em и применяет относительную нижнюю границу", () => {
		expect(normalizeTableColumnWidth(12.345678, undefined, "em")).toBe(12.3456);
		expect(normalizeTableColumnWidth(1, undefined, "em")).toBe(DEFAULT_TABLE_COLUMN_MIN_WIDTH_EM);
		expect(normalizeTableColumnWidth(Number.NaN, 2.5, "em")).toBe(2.5);
		expect(normalizeTableColumnSizing({ A: 12.5, B: Number.NaN, C: 1 }, undefined, "em")).toEqual({ A: 12.5, C: 4 });
	});

	it("изменяет одну относительную ширину без потери дробных размеров остальных колонок", () => {
		const sizing = patchTableColumnWidth({ A: 10.125, B: 8.5 }, "B", 9.75, undefined, "em");

		expect(sizing).toEqual({ A: 10.125, B: 9.75 });
		expect(removeTableColumnWidth(sizing, "B")).toEqual({ A: 10.125 });
	});
});
