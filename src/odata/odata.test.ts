import { beforeEach, describe, expect, it } from "vitest";

import { buildSeparatedArrays } from "./buildSeparatedArrays";
import { ODataDateFormat } from "./dateUtils";
import { findCollectionPairs } from "./findCollectionPairs";
import { useODataCollectionStore } from "./store";
import type { CollectionItem, CollectionPair } from "./types";

describe("buildSeparatedArrays", () => {
	const pairs: CollectionPair[] = [
		{ codeKey: "code", textKey: "text" },
		{ codeKey: "group", textKey: "groupText" },
		{ codeKey: "missing", textKey: "missingText" }
	];

	const rows: CollectionItem[] = [
		{ code: "B", text: "Бета", group: "2", groupText: "Группа 2" },
		{ code: "A", text: "Альфа", group: "1", groupText: "Группа 1" },
		{ code: "A", text: "Альфа", group: "1", groupText: "Группа 1" },
		{ code: "C", text: "", group: "3", groupText: "Группа 3" }
	];

	it("создает уникальные code/text массивы для каждой валидной пары", () => {
		expect(buildSeparatedArrays(rows, pairs)).toEqual({
			code: [
				{ code: "A", text: "Альфа" },
				{ code: "B", text: "Бета" }
			],
			group: [
				{ group: "1", groupText: "Группа 1" },
				{ group: "2", groupText: "Группа 2" },
				{ group: "3", groupText: "Группа 3" }
			],
			missing: []
		});
	});

	it("умеет сортировать по текстовому полю и сохранять пустой текст по явному флагу", () => {
		expect(buildSeparatedArrays(rows, pairs, false, false).code).toEqual([
			{ code: "C", text: "" },
			{ code: "A", text: "Альфа" },
			{ code: "B", text: "Бета" }
		]);
	});

	it("возвращает пустые массивы для всех пар при пустом input", () => {
		expect(buildSeparatedArrays([], pairs)).toEqual({ code: [], group: [], missing: [] });
	});
});

describe("findCollectionPairs", () => {
	it("находит пары code/text по стандартным суффиксам без учета регистра", () => {
		expect(findCollectionPairs({ code: "A", code_TEXT: "Альфа", alone: "1" }, { returnUnpaired: true })).toEqual({
			pairs: [{ codeKey: "code", textKey: "code_TEXT" }],
			pairsMap: { code: "code_TEXT" },
			unpaired: ["alone"]
		});
	});

	it("поддерживает пользовательские суффиксы с экранированием regexp-символов", () => {
		expect(findCollectionPairs({ material: "1", "material.label": "Материал" }, { textSuffixes: [".label"] }).pairs).toEqual([
			{ codeKey: "material", textKey: "material.label" }
		]);
	});
});

describe("ODataDateFormat", () => {
	it("форматирует Date в SAP OData literals", () => {
		const date = new Date(2026, 6, 3, 4, 5, 6);

		expect(ODataDateFormat.datetime(date)).toBe("datetime'2026-07-03T04:05:06'");
		expect(ODataDateFormat.datetimeOffset(date)).toBe(`datetimeoffset'${date.toISOString()}'`);
		expect(ODataDateFormat.time(date)).toBe("time'PT04H05M06S'");
	});
});

describe("useODataCollectionStore", () => {
	beforeEach(() => {
		useODataCollectionStore.setState({
			defaultMaxVisibleItems: 200,
			defaultMinSearchCodeLength: 3,
			defaultMinSearchTextLength: 1,
			defaultSearchDebounceDelay: 100
		});
	});

	it("хранит значения по умолчанию", () => {
		expect(useODataCollectionStore.getState()).toMatchObject({
			defaultMaxVisibleItems: 200,
			defaultMinSearchCodeLength: 3,
			defaultMinSearchTextLength: 1,
			defaultSearchDebounceDelay: 100
		});
	});

	it("обновляет каждый параметр своим setter-ом", () => {
		const { setDefaultMaxVisibleItems, setDefaultMinSearchCodeLength, setDefaultMinSearchTextLength, setDefaultSearchDebounceDelay } =
			useODataCollectionStore.getState();

		setDefaultMaxVisibleItems(50);
		setDefaultMinSearchCodeLength(4);
		setDefaultMinSearchTextLength(2);
		setDefaultSearchDebounceDelay(250);

		expect(useODataCollectionStore.getState()).toMatchObject({
			defaultMaxVisibleItems: 50,
			defaultMinSearchCodeLength: 4,
			defaultMinSearchTextLength: 2,
			defaultSearchDebounceDelay: 250
		});
	});
});
