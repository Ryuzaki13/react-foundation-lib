import { describe, expect, it } from "vitest";

import {
	addUnique,
	appendMissingIds,
	arrayGroupBy,
	arrayGroupByToArray,
	arrayToMap,
	arrayUniqueBy,
	arraysEqual,
	filterAndDeduplicateIds,
	moveItem,
	normalizeObjects,
	normalizeStringArray,
	pickExistingMapValues
} from "./array";

describe("array helpers", () => {
	const rows = [
		{ id: "A", group: "one", value: 1 },
		{ id: "B", group: "one", value: 2 },
		{ id: "A", group: "two", value: 3 }
	];

	it("группирует элементы по ключу, сохраняя порядок внутри групп", () => {
		expect(arrayGroupBy(rows, "group")).toEqual({
			one: [rows[0], rows[1]],
			two: [rows[2]]
		});
		expect(arrayGroupByToArray(rows, "group")).toEqual([
			{ key: "one", items: [rows[0], rows[1]] },
			{ key: "two", items: [rows[2]] }
		]);
	});

	it("строит map по первому встреченному значению ключа", () => {
		expect(arrayToMap(rows, "id")).toEqual({
			A: rows[0],
			B: rows[1]
		});
	});

	it("удаляет дубликаты по ключу без перестановки первого значения", () => {
		expect(arrayUniqueBy(rows, "id")).toEqual([rows[0], rows[1]]);
	});

	it("фильтрует id по разрешённому списку и удаляет дубликаты", () => {
		expect(filterAndDeduplicateIds(["D", "B", "UNKNOWN", "B"], ["A", "B", "C", "D"])).toEqual(["D", "B"]);
		expect(filterAndDeduplicateIds(undefined, ["A", "B"])).toEqual([]);
	});

	it("добавляет отсутствующие id без перестановки базового списка", () => {
		expect(appendMissingIds(["D", "B"], ["A", "B", "C", "D"])).toEqual(["D", "B", "A", "C"]);
	});

	it("выбирает значения map в порядке ключей и пропускает отсутствующие ключи", () => {
		const values = new Map([
			["A", 1],
			["B", 2],
			["C", 3]
		]);

		expect(pickExistingMapValues(["C", "UNKNOWN", "A"], values)).toEqual([3, 1]);
	});

	it("сравнивает массивы строго по длине, порядку и ссылочным значениям", () => {
		const item = { id: "A" };

		expect(arraysEqual([item, "B"], [item, "B"])).toBe(true);
		expect(arraysEqual(["A", "B"], ["B", "A"])).toBe(false);
		expect(arraysEqual([{ id: "A" }], [{ id: "A" }])).toBe(false);
	});

	it("перемещает элемент без мутации исходного массива и игнорирует некорректные индексы", () => {
		const source = ["A", "B", "C"];

		expect(moveItem(source, 0, 2)).toEqual(["B", "C", "A"]);
		expect(source).toEqual(["A", "B", "C"]);
		expect(moveItem(source, -1, 2)).toEqual(source);
		expect(moveItem(source, 1, 1)).toEqual(source);
	});

	it("нормализует объекты по trimmed key и отсекает пустые/дубликаты", () => {
		const source = [
			{ id: " A ", value: 1 },
			{ id: "", value: 2 },
			{ id: "A", value: 3 },
			{ id: "B", value: 4 }
		];

		expect(normalizeObjects(source, "id")).toEqual([
			{ id: " A ", value: 1 },
			{ id: "B", value: 4 }
		]);
		expect(normalizeObjects(source, "id", (item, key) => ({ id: key, label: String(item.value) }))).toEqual([
			{ id: "A", label: "1" },
			{ id: "B", label: "4" }
		]);
		expect(normalizeObjects<{ id: string }, "id">(undefined, "id")).toBeUndefined();
		expect(normalizeObjects([{ id: " " }], "id")).toBeUndefined();
	});

	it("может вернуть исходные объекты при copyist=false", () => {
		const source = [{ id: "A" }];
		const result = normalizeObjects(source, "id", false);

		expect(result?.[0]).toBe(source[0]);
	});

	it("нормализует строковый массив и добавляет уникальные id в target", () => {
		expect(normalizeStringArray([" A ", "", "A", "B "])).toEqual(["A", "B"]);
		expect(normalizeStringArray([])).toBeUndefined();

		const target: string[] = [];
		const seen = new Set<string>();

		addUnique(target, seen, " A ");
		addUnique(target, seen, "A");
		addUnique(target, seen, " ");

		expect(target).toEqual(["A"]);
	});
});
