import { describe, expect, it } from "vitest";

import { moveArrayItem, moveArrayItemByIndex } from "./reorder";

describe("reorder helper", () => {
	it("перемещает элемент по всем поддержанным действиям", () => {
		const items = ["A", "B", "C", "D"];

		expect(moveArrayItemByIndex(items, 2, "start")).toEqual(["C", "A", "B", "D"]);
		expect(moveArrayItemByIndex(items, 1, "end")).toEqual(["A", "C", "D", "B"]);
		expect(moveArrayItemByIndex(items, 2, "up")).toEqual(["A", "C", "B", "D"]);
		expect(moveArrayItemByIndex(items, 1, "down")).toEqual(["A", "C", "B", "D"]);
	});

	it("оставляет массив без изменений на краях и для невалидного индекса", () => {
		const items = ["A", "B", "C"];

		expect(moveArrayItemByIndex(items, 0, "start")).toEqual(items);
		expect(moveArrayItemByIndex(items, 2, "down")).toEqual(items);
		expect(moveArrayItemByIndex(items, -1, "up")).toEqual(items);
	});

	it("перемещает элемент между произвольными индексами", () => {
		const items = ["A", "B", "C", "D"];

		expect(moveArrayItem(items, 0, 2)).toEqual(["B", "C", "A", "D"]);
		expect(moveArrayItem(items, 3, 1)).toEqual(["A", "D", "B", "C"]);
	});

	it("возвращает копию без перестановки для некорректных индексов", () => {
		const items = ["A", "B", "C"];
		const nextItems = moveArrayItem(items, 1, 1);

		expect(moveArrayItem(items, -1, 1)).toEqual(items);
		expect(moveArrayItem(items, 1, 99)).toEqual(items);
		expect(nextItems).toEqual(items);
		expect(nextItems).not.toBe(items);
	});
});
