import { describe, expect, it } from "vitest";

import {
	areTableCellSelectionsEqual,
	normalizeTableCellSelectionActivationMode,
	pruneTableCellSelection,
	shouldActivateTableCellSelection,
	toggleTableCellSelection
} from "./cellSelection";

describe("table cell selection", () => {
	it("очищает none и оставляет последнюю доступную координату в single", () => {
		const selection = [
			{ rowId: "missing", columnId: "A" },
			{ rowId: "row-2", columnId: "B" },
			{ rowId: "row-1", columnId: "A" },
			{ rowId: "row-2", columnId: "B" }
		];

		expect(pruneTableCellSelection(selection, ["row-1", "row-2"], ["A", "B"], "none")).toEqual([]);
		expect(pruneTableCellSelection(selection, ["row-1", "row-2"], ["A", "B"], "single")).toEqual([{ rowId: "row-2", columnId: "B" }]);
	});

	it("дедуплицирует и упорядочивает multi без мутации input", () => {
		const selection = [
			{ rowId: "row-2", columnId: "B" },
			{ rowId: "row-1", columnId: "B" },
			{ rowId: "row-1", columnId: "A" },
			{ rowId: "row-1", columnId: "A" }
		];
		const snapshot = selection.map((cell) => ({ ...cell }));

		expect(pruneTableCellSelection(selection, ["row-1", "row-2"], ["A", "B"], "multi")).toEqual([
			{ rowId: "row-1", columnId: "A" },
			{ rowId: "row-1", columnId: "B" },
			{ rowId: "row-2", columnId: "B" }
		]);
		expect(selection).toEqual(snapshot);
	});

	it("переключает single и multi независимо", () => {
		const first = { rowId: "row-1", columnId: "A" };
		const second = { rowId: "row-1", columnId: "B" };

		expect(toggleTableCellSelection([first], first, "single")).toEqual([]);
		expect(toggleTableCellSelection([first], second, "single")).toEqual([second]);
		expect(toggleTableCellSelection([first], second, "multi")).toEqual([first, second]);
		expect(toggleTableCellSelection([first, second], first, "multi")).toEqual([second]);
	});

	it("сравнивает наборы координат без зависимости от порядка", () => {
		const first = { rowId: "row-1", columnId: "A" };
		const second = { rowId: "row-2", columnId: "B" };

		expect(areTableCellSelectionsEqual([first, second], [second, first])).toBe(true);
		expect(areTableCellSelectionsEqual([first], [second])).toBe(false);
		expect(areTableCellSelectionsEqual([first, first], [first])).toBe(true);
		expect(areTableCellSelectionsEqual([first, first], [first, second])).toBe(false);
	});

	it("активирует primary-modifier только для безопасного Ctrl или Command", () => {
		const modifiers = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };

		expect(shouldActivateTableCellSelection(modifiers, "direct")).toBe(true);
		expect(shouldActivateTableCellSelection(modifiers, "primary-modifier")).toBe(false);
		expect(shouldActivateTableCellSelection({ ...modifiers, ctrlKey: true }, "primary-modifier")).toBe(true);
		expect(shouldActivateTableCellSelection({ ...modifiers, metaKey: true }, "primary-modifier")).toBe(true);
		expect(shouldActivateTableCellSelection({ ...modifiers, ctrlKey: true, shiftKey: true }, "primary-modifier")).toBe(false);
		expect(shouldActivateTableCellSelection({ ...modifiers, metaKey: true, altKey: true }, "primary-modifier")).toBe(false);
	});

	it("нормализует неизвестный activation mode на заданный fallback", () => {
		expect(normalizeTableCellSelectionActivationMode("primary-modifier")).toBe("primary-modifier");
		expect(normalizeTableCellSelectionActivationMode("meta")).toBe("direct");
		expect(normalizeTableCellSelectionActivationMode(null, "primary-modifier")).toBe("primary-modifier");
	});
});
