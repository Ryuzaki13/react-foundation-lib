import { describe, expect, it } from "vitest";

import {
	collapseChainedODataSegmentFilterValues,
	compileFiltersToExpression,
	flattenFilterValuesToODataDependencies,
	mergeFilterValuePatch,
	normalizeDictionaryCodeKey,
	resolveODataFilterDefinitionActiveColumnIds,
	resolveODataFilterDefinitionColumnIds,
	sanitizeFilterBinding,
	sanitizeFilterConditionGroup,
	sanitizeFilterDefinitions,
	sanitizeFilterValue,
	sanitizeFilterValues,
	type ODataCompiledFilterDefinition
} from "./filterDefinitions";
import { buildODataFilter } from "./filters";

describe("sanitize filter definitions", () => {
	it("нормализует condition group и отбрасывает статические условия без значения", () => {
		expect(
			sanitizeFilterConditionGroup({
				and: false,
				conditions: [
					{ columnId: " AMOUNT ", operation: "gt", valueSource: "static", value: 100 },
					{ columnId: " EMPTY ", operation: "eq", valueSource: "static", value: Number.NaN },
					{ columnId: " NAME ", operation: "contains", valueSource: "input" }
				]
			})
		).toEqual({
			and: false,
			conditions: [
				{ columnId: "AMOUNT", operation: "gt", valueSource: "static", value: 100 },
				{ columnId: "NAME", operation: "contains", valueSource: "input", value: undefined }
			]
		});

		expect(sanitizeFilterConditionGroup({ conditions: [{ operation: "eq", valueSource: "static" }] })).toBeUndefined();
	});

	it("нормализует list/boolean/value binding без потери пустого ключа option", () => {
		expect(
			sanitizeFilterBinding({
				kind: "list",
				options: [
					{ key: " A ", label: " " },
					{ key: " ", label: "Пустой" }
				]
			})
		).toEqual({
			kind: "list",
			options: [
				{ key: "A", label: "A", filter: undefined },
				{ key: "", label: "Пустой", filter: undefined }
			]
		});
		expect(sanitizeFilterBinding({ kind: "list", options: [] })).toBeUndefined();
		expect(sanitizeFilterBinding({ kind: "boolean", trueFilter: { conditions: [] } })).toEqual({
			kind: "boolean",
			trueFilter: undefined
		});
		expect(sanitizeFilterBinding({ kind: "value" })).toEqual({
			kind: "value",
			valueFilter: undefined
		});
	});

	it("нормализует definitions и выводит физические columnIds из binding", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: " SEG ",
				ownerColumnId: " TEXT_SEGMENT ",
				columnIds: ["IGNORED"],
				kind: "segment",
				componentId: "multi-select",
				controlType: "string",
				dictionaryCodeKey: " TEXT_SEGMENT "
			},
			{
				id: " TREE ",
				ownerColumnId: " UNKNOWN ",
				columnIds: [" TEXT_GROUP ", "TEXT_GROUP", " TEXT_PARENT "],
				kind: "tree",
				componentId: "tree-multi-select",
				controlType: "string"
			},
			{
				id: " LOCAL ",
				ownerColumnId: " OWNER ",
				columnIds: [],
				kind: "local",
				componentId: "select",
				controlType: "string",
				binding: {
					kind: "list",
					options: [
						{
							key: "A",
							label: "A",
							filter: {
								conditions: [
									{ columnId: " TARGET_A ", operation: "eq", valueSource: "static", value: "A" },
									{ operation: "eq", valueSource: "static", value: "fallback" }
								]
							}
						}
					]
				}
			},
			{ id: " ADV ", ownerColumnId: " TEXT_ADVANCED ", kind: "advanced", componentId: "advanced-search-select", configId: "cfg" },
			{ id: " COL ", ownerColumnId: " TEXT_COLUMN ", kind: "column" }
		];

		expect(sanitizeFilterDefinitions(definitions)).toMatchObject([
			{
				id: "SEG",
				ownerColumnId: "TEXT_SEGMENT",
				columnIds: ["TEXT_SEGMENT"],
				dictionaryCodeKey: undefined
			},
			{
				id: "TREE",
				ownerColumnId: "TEXT_GROUP",
				columnIds: ["TEXT_GROUP", "TEXT_PARENT"]
			},
			{
				id: "LOCAL",
				ownerColumnId: "OWNER",
				columnIds: ["TARGET_A", "OWNER"]
			},
			{ id: "ADV", ownerColumnId: "TEXT_ADVANCED" },
			{ id: "COL", ownerColumnId: "TEXT_COLUMN" }
		]);
	});

	it("отбрасывает definitions без обязательных полей или валидного binding", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: " ",
				ownerColumnId: "TEXT_SEGMENT",
				columnIds: ["TEXT_SEGMENT"],
				kind: "segment",
				componentId: "select",
				controlType: "string"
			},
			{
				id: "TREE",
				ownerColumnId: "TEXT_SEGMENT",
				columnIds: ["TEXT_SEGMENT"],
				kind: "tree",
				componentId: "tree-select",
				controlType: "string"
			},
			{
				id: "LOCAL",
				ownerColumnId: "TEXT_LOCAL",
				columnIds: [],
				kind: "local",
				componentId: "select",
				controlType: "string",
				binding: { kind: "list", options: [] }
			}
		];

		expect(sanitizeFilterDefinitions(definitions)).toEqual([]);
	});

	it("нормализует legacy kind/componentId из сохранённых конфигов", () => {
		const legacySegment: ODataCompiledFilterDefinition = {
			id: "SEG",
			ownerColumnId: "TEXT_SEGMENT",
			columnIds: ["TEXT_SEGMENT"],
			kind: "segment",
			componentId: "multi-select",
			controlType: "string"
		};
		const legacyTree: ODataCompiledFilterDefinition = {
			id: "TREE",
			ownerColumnId: "TEXT_ROOT",
			columnIds: ["TEXT_ROOT", "TEXT_CHILD"],
			kind: "tree",
			componentId: "tree-multi-select",
			controlType: "string"
		};
		Object.defineProperty(legacySegment, "kind", { value: "odata-segment", writable: true });
		Object.defineProperty(legacyTree, "kind", { value: "odata-tree", writable: true });
		Object.defineProperty(legacyTree, "componentId", { value: "treeSelect", writable: true });

		expect(sanitizeFilterDefinitions([legacySegment, legacyTree])).toMatchObject([
			{ id: "SEG", kind: "segment", componentId: "multi-select" },
			{ id: "TREE", kind: "tree", componentId: "tree-select" }
		]);
	});

	it("санитизирует значения фильтров, dedupe и patch-обновления", () => {
		const date = new Date("2026-07-02T00:00:00.000Z");

		expect(sanitizeFilterValue([" b ", "a", "a", 2, 2, false, Number.NaN, new Date("bad")])).toEqual([false, 2, "a", "b"]);
		expect(sanitizeFilterValue({ " TEXT_DIVISION ": [" 01 ", "01", ""], " ": ["x"], TEXT_INVALID: [1, ""] })).toEqual({
			TEXT_DIVISION: ["01"]
		});
		expect(sanitizeFilterValue(date)).toBe(date);
		expect(sanitizeFilterValue(new Date("bad"))).toBeUndefined();
		expect(
			sanitizeFilterValues({
				" SEG ": ["02", "01"],
				" ": "skip",
				TEXT_INVALID: Number.NaN
			})
		).toEqual({
			SEG: ["01", "02"]
		});
		expect(mergeFilterValuePatch({ A: "1", B: "2" }, "A", undefined)).toEqual({ B: "2" });
		expect(mergeFilterValuePatch({ A: "1" }, " B ", " 2 ")).toEqual({ A: "1", " B ": "2" });
		expect(normalizeDictionaryCodeKey(" TEXT_CODE ", "TEXT_OWNER")).toBe("TEXT_CODE");
		expect(normalizeDictionaryCodeKey("TEXT_OWNER", "TEXT_OWNER")).toBeUndefined();
	});
});

describe("compileFiltersToExpression", () => {
	it("возвращает пустые результаты для невалидных definitions или values", () => {
		const invalidDefinition: ODataCompiledFilterDefinition = {
			id: " ",
			ownerColumnId: "TEXT_SEGMENT",
			columnIds: ["TEXT_SEGMENT"],
			kind: "segment",
			componentId: "select",
			controlType: "string"
		};

		expect(resolveODataFilterDefinitionColumnIds(invalidDefinition)).toEqual([]);
		expect(resolveODataFilterDefinitionActiveColumnIds(invalidDefinition, "A")).toEqual([]);
		expect(compileFiltersToExpression()).toBeUndefined();
		expect(compileFiltersToExpression([], { A: "1" })).toBeUndefined();
		expect(compileFiltersToExpression([invalidDefinition], { A: "1" })).toBeUndefined();
	});

	it("возвращает активные колонки для segment, column, advanced, boolean и value-фильтров", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "SEG",
				ownerColumnId: "TEXT_SEGMENT",
				columnIds: ["TEXT_SEGMENT"],
				kind: "segment",
				componentId: "select",
				controlType: "string"
			},
			{ id: "COLUMN", ownerColumnId: "STATUS", kind: "column" },
			{ id: "ADVANCED", ownerColumnId: "ID", kind: "advanced", componentId: "advanced-search-select", configId: "ids" },
			{
				id: "ACTIVE",
				ownerColumnId: "IS_ACTIVE",
				columnIds: ["IS_ACTIVE"],
				kind: "local",
				componentId: "checkbox",
				controlType: "boolean",
				binding: {
					kind: "boolean",
					trueFilter: {
						conditions: [{ columnId: "ACTIVE_COLUMN", operation: "eq", valueSource: "static", value: true }]
					}
				}
			},
			{
				id: "SEARCH",
				ownerColumnId: "NAME",
				columnIds: ["NAME"],
				kind: "local",
				componentId: "text-input",
				controlType: "string",
				binding: {
					kind: "value",
					valueFilter: {
						conditions: [{ columnId: "FULL_NAME", operation: "contains", valueSource: "input" }]
					}
				}
			}
		];

		expect(resolveODataFilterDefinitionActiveColumnIds(definitions[0]!, "A")).toEqual(["TEXT_SEGMENT"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definitions[1]!, "A")).toEqual(["STATUS"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definitions[2]!, ["1"])).toEqual(["ID"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definitions[3]!, true)).toEqual(["ACTIVE_COLUMN"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definitions[3]!, false)).toEqual([]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definitions[4]!, "Иван")).toEqual(["FULL_NAME"]);
	});

	it("возвращает потенциальные и активные колонки локального list-фильтра", () => {
		const definition: ODataCompiledFilterDefinition = {
			id: "PAG_FILTER",
			ownerColumnId: "PAG_COMP",
			columnIds: ["PAG_COMP", "PAG_CFO"],
			kind: "local",
			componentId: "multi-select",
			controlType: "string",
			binding: {
				kind: "list",
				options: [
					{
						key: "COMP_X",
						label: "Компания X",
						filter: {
							conditions: [{ columnId: "PAG_COMP", operation: "eq", valueSource: "static", value: "X" }]
						}
					},
					{
						key: "CFO_X",
						label: "ЦФО X",
						filter: {
							conditions: [{ columnId: "PAG_CFO", operation: "eq", valueSource: "static", value: "X" }]
						}
					}
				]
			}
		};

		expect(resolveODataFilterDefinitionColumnIds(definition)).toEqual(["PAG_COMP", "PAG_CFO"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definition, ["COMP_X"])).toEqual(["PAG_COMP"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definition, ["UNKNOWN"])).toEqual([]);
	});

	it("возвращает активные колонки tree-фильтра по выбранным значениям", () => {
		const definition: ODataCompiledFilterDefinition = {
			id: "TEXT_DIVISION",
			ownerColumnId: "TEXT_DIVISION",
			columnIds: ["TEXT_DIVISION", "TEXT_GROUP"],
			kind: "tree",
			componentId: "tree-select",
			controlType: "string"
		};

		expect(resolveODataFilterDefinitionActiveColumnIds(definition, { TEXT_GROUP: ["01"] })).toEqual(["TEXT_GROUP"]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definition, { UNKNOWN: ["01"] })).toEqual([]);
		expect(resolveODataFilterDefinitionActiveColumnIds(definition, "01")).toEqual([]);
	});

	it("для select без explicit conditions использует default eq", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "TEXT_DIVISION",
				ownerColumnId: "TEXT_DIVISION",
				columnIds: ["TEXT_DIVISION"],
				kind: "segment",
				componentId: "select",
				controlType: "string"
			}
		];

		expect(
			compileFiltersToExpression(definitions, {
				TEXT_DIVISION: "01"
			})
		).toEqual({
			conditions: [
				{
					key: "TEXT_DIVISION",
					operation: "eq",
					value: "01"
				}
			]
		});
	});

	it("компилирует segment по owner-колонке, а зависимости отдаёт по кодовому полю справочника", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "TEXT_GROUP_PARENT",
				ownerColumnId: "TEXT_GROUP_PARENT",
				columnIds: ["TEXT_GROUP_PARENT"],
				kind: "segment",
				componentId: "multi-select",
				controlType: "string",
				dictionaryCodeKey: "TEXT_NODE_PARENT"
			}
		];
		const values = {
			TEXT_GROUP_PARENT: ["001", "002"]
		};

		expect(compileFiltersToExpression(definitions, values)).toEqual({
			conditions: [
				{
					key: "TEXT_GROUP_PARENT",
					operation: "eq",
					value: "001"
				},
				{
					key: "TEXT_GROUP_PARENT",
					operation: "eq",
					value: "002"
				}
			]
		});
		expect(flattenFilterValuesToODataDependencies(definitions, values)).toEqual({
			TEXT_NODE_PARENT: ["001", "002"]
		});
	});

	it("поддерживает несколько операций для одного option локального select", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "AMOUNT_BUCKET",
				ownerColumnId: "AMOUNT",
				columnIds: ["AMOUNT"],
				kind: "local",
				componentId: "select",
				controlType: "string",
				binding: {
					kind: "list",
					options: [
						{
							key: "LOW",
							label: "До 1000",
							filter: {
								and: true,
								conditions: [
									{ operation: "ne", valueSource: "static", value: 0 },
									{ operation: "lt", valueSource: "static", value: 1000 }
								]
							}
						}
					]
				}
			}
		];

		expect(
			compileFiltersToExpression(definitions, {
				AMOUNT_BUCKET: "LOW"
			})
		).toEqual({
			and: true,
			conditions: [
				{
					key: "AMOUNT",
					operation: "ne",
					value: 0
				},
				{
					key: "AMOUNT",
					operation: "lt",
					value: 1000
				}
			]
		});
	});

	it("поддерживает связку ИЛИ для нескольких операций одного option локального select", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "AMOUNT_BUCKET",
				ownerColumnId: "AMOUNT",
				columnIds: ["AMOUNT"],
				kind: "local",
				componentId: "select",
				controlType: "string",
				binding: {
					kind: "list",
					options: [
						{
							key: "LOW_OR_EMPTY",
							label: "До 1000 или 0",
							filter: {
								and: false,
								conditions: [
									{ operation: "eq", valueSource: "static", value: 0 },
									{ operation: "lt", valueSource: "static", value: 1000 }
								]
							}
						}
					]
				}
			}
		];

		const expression = compileFiltersToExpression(definitions, {
			AMOUNT_BUCKET: "LOW_OR_EMPTY"
		});

		expect(buildODataFilter(expression)).toBe("(AMOUNT eq 0 or AMOUNT lt 1000)");
	});

	it("компилирует option локального select по привязанной колонке", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "PAG_FILTER",
				ownerColumnId: "PAG_COMP",
				columnIds: ["PAG_COMP"],
				kind: "local",
				componentId: "select",
				controlType: "string",
				binding: {
					kind: "list",
					options: [
						{
							key: "COMP_X",
							label: "Компания X",
							filter: {
								conditions: [{ columnId: "PAG_COMP", operation: "eq", valueSource: "static", value: "X" }]
							}
						}
					]
				}
			}
		];

		const expression = compileFiltersToExpression(definitions, {
			PAG_FILTER: "COMP_X"
		});

		expect(buildODataFilter(expression)).toBe("PAG_COMP eq 'X'");
	});

	it("компилирует options локального multi-select по разным колонкам через ИЛИ", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "PAG_FILTER",
				ownerColumnId: "PAG_COMP",
				columnIds: ["PAG_COMP", "PAG_CFO"],
				kind: "local",
				componentId: "multi-select",
				controlType: "string",
				binding: {
					kind: "list",
					options: [
						{
							key: "COMP_X",
							label: "Компания X",
							filter: {
								conditions: [{ columnId: "PAG_COMP", operation: "eq", valueSource: "static", value: "X" }]
							}
						},
						{
							key: "CFO_X",
							label: "ЦФО X",
							filter: {
								conditions: [{ columnId: "PAG_CFO", operation: "eq", valueSource: "static", value: "X" }]
							}
						}
					]
				}
			}
		];

		const expression = compileFiltersToExpression(definitions, {
			PAG_FILTER: ["COMP_X", "CFO_X"]
		});

		expect(buildODataFilter(expression)).toBe("(PAG_CFO eq 'X' or PAG_COMP eq 'X')");
	});

	it("tree value map компилирует условия по нескольким columnIds", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "TREE",
				ownerColumnId: "TEXT_DIVISION",
				columnIds: ["TEXT_DIVISION", "TEXT_NODE"],
				kind: "tree",
				componentId: "tree-multi-select",
				controlType: "string"
			}
		];

		expect(
			compileFiltersToExpression(definitions, {
				TREE: {
					TEXT_DIVISION: ["01"],
					TEXT_NODE: ["02"]
				}
			})
		).toEqual({
			and: true,
			filters: [
				{
					conditions: [
						{
							key: "TEXT_DIVISION",
							operation: "eq",
							value: "01"
						}
					]
				},
				{
					conditions: [
						{
							key: "TEXT_NODE",
							operation: "eq",
							value: "02"
						}
					]
				}
			]
		});
	});

	it("компилирует local boolean и value binding с default и explicit conditions", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "ACTIVE",
				ownerColumnId: "IS_ACTIVE",
				columnIds: ["IS_ACTIVE"],
				kind: "local",
				componentId: "checkbox",
				controlType: "boolean",
				binding: { kind: "boolean" }
			},
			{
				id: "SEARCH",
				ownerColumnId: "NAME",
				columnIds: ["NAME"],
				kind: "local",
				componentId: "text-input",
				controlType: "string",
				binding: {
					kind: "value",
					valueFilter: {
						conditions: [{ columnId: "FULL_NAME", operation: "contains", valueSource: "input" }]
					}
				}
			}
		];

		expect(buildODataFilter(compileFiltersToExpression(definitions, { ACTIVE: true, SEARCH: " Иван " }))).toBe(
			"(IS_ACTIVE eq 'X' and substringof('Иван',FULL_NAME))"
		);
		expect(compileFiltersToExpression(definitions, { ACTIVE: false })).toBeUndefined();
	});

	it("компилирует column и advanced filters только из поддерживаемых значений", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{ id: "COLUMN", ownerColumnId: "STATUS", kind: "column" },
			{ id: "ADVANCED", ownerColumnId: "ID", kind: "advanced", componentId: "advanced-search-select", configId: "ids" }
		];

		expect(buildODataFilter(compileFiltersToExpression(definitions, { COLUMN: ["B", "A"], ADVANCED: ["42", "43"] }))).toBe(
			"((STATUS eq 'A' or STATUS eq 'B') and (ID eq '42' or ID eq '43'))"
		);
		expect(compileFiltersToExpression(definitions, { ADVANCED: "42" })).toBeUndefined();
	});

	it("компилирует local value без explicit conditions через default eq", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "TEXT_VALUE",
				ownerColumnId: "STATUS",
				columnIds: ["STATUS"],
				kind: "local",
				componentId: "multi-select",
				controlType: "string",
				binding: { kind: "value" }
			}
		];

		expect(buildODataFilter(compileFiltersToExpression(definitions, { TEXT_VALUE: ["B", "A"] }))).toBe("(STATUS eq 'A' or STATUS eq 'B')");
		expect(compileFiltersToExpression(definitions, { TEXT_VALUE: { STATUS: ["A"] } })).toBeUndefined();
	});

	it("flatten dependencies поддерживает scalar segment, tree и пропускает local", () => {
		const definitions: ODataCompiledFilterDefinition[] = [
			{
				id: "SEG",
				ownerColumnId: "TEXT_SEGMENT",
				columnIds: ["TEXT_SEGMENT"],
				kind: "segment",
				componentId: "select",
				controlType: "string"
			},
			{
				id: "TREE",
				ownerColumnId: "TEXT_DIVISION",
				columnIds: ["TEXT_DIVISION", "TEXT_NODE"],
				kind: "tree",
				componentId: "tree-multi-select",
				controlType: "string"
			},
			{
				id: "LOCAL",
				ownerColumnId: "STATUS",
				columnIds: ["STATUS"],
				kind: "local",
				componentId: "checkbox",
				controlType: "boolean",
				binding: { kind: "boolean" }
			}
		];

		expect(flattenFilterValuesToODataDependencies(definitions, { SEG: "A", TREE: { TEXT_NODE: ["01"] }, LOCAL: true })).toEqual({
			TEXT_SEGMENT: ["A"],
			TEXT_NODE: ["01"]
		});
		expect(flattenFilterValuesToODataDependencies(definitions, { TREE: "invalid" })).toEqual({});
	});

	it("оставляет только самый глубокий segment-фильтр в OData-цепочке", () => {
		expect(
			collapseChainedODataSegmentFilterValues(
				{
					TEXT_DIVISION: ["01"],
					TEXT_NODE: ["02"],
					LOCAL: true,
					TREE: {
						TEXT_DIVISION: ["01"]
					}
				},
				["TEXT_DIVISION", "TEXT_NODE"],
				{
					main: [
						{ codeKey: "TEXT_DIVISION", count: 10 },
						{ codeKey: "TEXT_NODE", count: 40 }
					]
				}
			)
		).toEqual({
			TEXT_NODE: ["02"],
			LOCAL: true,
			TREE: {
				TEXT_DIVISION: ["01"]
			}
		});
	});

	it("collapse chained segment values не трогает пустые values и не-OData segment filters", () => {
		expect(collapseChainedODataSegmentFilterValues({}, ["TEXT_DIVISION"], {})).toEqual({});
		expect(
			collapseChainedODataSegmentFilterValues(
				{
					TEXT_DIVISION: ["01"],
					LOCAL_SEGMENT_LIKE: ["02"]
				},
				["TEXT_DIVISION"],
				{
					main: [
						{ codeKey: "TEXT_DIVISION", count: 10 },
						{ codeKey: "LOCAL_SEGMENT_LIKE", count: 20 }
					]
				}
			)
		).toEqual({
			TEXT_DIVISION: ["01"],
			LOCAL_SEGMENT_LIKE: ["02"]
		});
	});
});
