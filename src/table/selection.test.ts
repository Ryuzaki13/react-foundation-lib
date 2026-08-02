import { describe, expect, it } from "vitest";

import { areTableRowSelectionsEqual, normalizeTableSelectionMode, pruneTableRowSelection, toggleTableRowSelection } from "./selection";

describe("tree-table selection", () => {
	it("очищает выбор в режиме none", () => {
		expect(pruneTableRowSelection({ a: true, b: true }, ["a", "b"], "none")).toEqual({});
	});

	it("оставляет только последнюю доступную строку в режиме single", () => {
		expect(pruneTableRowSelection({ a: true, b: true, missing: true }, ["a", "b"], "single")).toEqual({ b: true });
	});

	it("в режиме single повторный клик не снимает уже выбранную строку", () => {
		expect(toggleTableRowSelection({ a: true }, "a", "single")).toEqual({ a: true });
		expect(toggleTableRowSelection({ a: true }, "b", "single")).toEqual({ b: true });
		expect(toggleTableRowSelection({ a: true, b: true }, "a", "single")).toEqual({ a: true });
	});

	it("в режиме multi строка переключается как toggle", () => {
		expect(toggleTableRowSelection({ a: true }, "b", "multi")).toEqual({ a: true, b: true });
		expect(toggleTableRowSelection({ a: true, b: true }, "b", "multi")).toEqual({ a: true });
	});

	it("нормализует неизвестное значение режима на fallback", () => {
		expect(normalizeTableSelectionMode("multi")).toBe("multi");
		expect(normalizeTableSelectionMode("invalid")).toBe("none");
		expect(normalizeTableSelectionMode(null, "single")).toBe("single");
	});

	it("сравнивает активные строки без зависимости от порядка ключей", () => {
		expect(areTableRowSelectionsEqual({ a: true, b: true }, { b: true, a: true })).toBe(true);
		expect(areTableRowSelectionsEqual({ a: true, b: false }, { a: true })).toBe(true);
		expect(areTableRowSelectionsEqual({ a: true }, { b: true })).toBe(false);
	});
});
