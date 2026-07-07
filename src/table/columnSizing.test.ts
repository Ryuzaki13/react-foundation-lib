import { describe, expect, it } from "vitest";

import {
	DEFAULT_TABLE_COLUMN_MIN_WIDTH,
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
});
