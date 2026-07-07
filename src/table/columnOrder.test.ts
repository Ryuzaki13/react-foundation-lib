import { describe, expect, it } from "vitest";

import { normalizeTableColumnOrder, reorderTableHeaderColumns, resolveReorderedTableHeaderColumns } from "./columnOrder";

describe("normalizeTableColumnOrder", () => {
	it("удаляет пустые и повторяющиеся id", () => {
		expect(normalizeTableColumnOrder(["A", "", "B", "A"])).toEqual(["A", "B"]);
	});
});

describe("reorderTableHeaderColumns", () => {
	it("переставляет top-level колонку внутри обычной зоны", () => {
		const next = reorderTableHeaderColumns({
			order: ["A", "B", "C", "D"],
			headerIds: ["A", "B", "C", "D"],
			lockedIds: [],
			pinnedIds: [],
			activeId: "C",
			overId: "A"
		});

		expect(next).toEqual(["C", "A", "B", "D"]);
	});

	it("не переставляет child-колонку группы", () => {
		const next = reorderTableHeaderColumns({
			order: ["PARENT", "CHILD", "TAIL"],
			headerIds: ["PARENT", "TAIL"],
			lockedIds: [],
			pinnedIds: [],
			activeId: "CHILD",
			overId: "TAIL"
		});

		expect(next).toEqual(["PARENT", "CHILD", "TAIL"]);
	});

	it("переставляет parent-группу как top-level колонку", () => {
		const next = reorderTableHeaderColumns({
			order: ["A", "PARENT", "B"],
			headerIds: ["A", "PARENT", "B"],
			lockedIds: [],
			pinnedIds: [],
			activeId: "PARENT",
			overId: "B"
		});

		expect(next).toEqual(["A", "B", "PARENT"]);
	});

	it("не двигает locked колонку", () => {
		const next = reorderTableHeaderColumns({
			order: ["GROUP_A", "A", "B"],
			headerIds: ["GROUP_A", "A", "B"],
			lockedIds: ["GROUP_A"],
			pinnedIds: [],
			activeId: "GROUP_A",
			overId: "B"
		});

		expect(next).toEqual(["GROUP_A", "A", "B"]);
	});

	it("не принимает drop на locked колонку", () => {
		const next = reorderTableHeaderColumns({
			order: ["GROUP_A", "A", "B"],
			headerIds: ["GROUP_A", "A", "B"],
			lockedIds: ["GROUP_A"],
			pinnedIds: [],
			activeId: "B",
			overId: "GROUP_A"
		});

		expect(next).toEqual(["GROUP_A", "A", "B"]);
	});

	it("блокирует перенос pinned-колонки в обычную зону", () => {
		const next = reorderTableHeaderColumns({
			order: ["A", "B", "C", "D"],
			headerIds: ["A", "B", "C", "D"],
			lockedIds: [],
			pinnedIds: ["A", "B"],
			activeId: "B",
			overId: "C"
		});

		expect(next).toEqual(["A", "B", "C", "D"]);
	});

	it("блокирует перенос pinned-колонки внутри pinned-зоны", () => {
		const next = reorderTableHeaderColumns({
			order: ["A", "B", "C", "D"],
			headerIds: ["A", "B", "C", "D"],
			lockedIds: [],
			pinnedIds: ["A", "B"],
			activeId: "B",
			overId: "A"
		});

		expect(next).toEqual(["A", "B", "C", "D"]);
	});

	it("блокирует перенос обычной колонки в pinned-зону", () => {
		const next = reorderTableHeaderColumns({
			order: ["A", "B", "C", "D"],
			headerIds: ["A", "B", "C", "D"],
			lockedIds: [],
			pinnedIds: ["A", "B"],
			activeId: "C",
			overId: "B"
		});

		expect(next).toEqual(["A", "B", "C", "D"]);
	});
});

describe("resolveReorderedTableHeaderColumns", () => {
	it("возвращает null, если итоговый порядок не изменился", () => {
		expect(
			resolveReorderedTableHeaderColumns({
				order: ["A", "B"],
				headerIds: ["A", "B"],
				activeId: "A",
				overId: "A"
			})
		).toBeNull();
	});

	it("возвращает новый порядок, если перестановка разрешена", () => {
		expect(
			resolveReorderedTableHeaderColumns({
				order: ["A", "B"],
				headerIds: ["A", "B"],
				activeId: "B",
				overId: "A"
			})
		).toEqual(["B", "A"]);
	});
});
