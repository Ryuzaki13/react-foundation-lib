import { describe, expect, it } from "vitest";

import {
	buildODataFilter,
	buildODataFilterRecursive,
	createFilter,
	createFilterBetween,
	createFilterContains,
	createFilterEqual,
	createFilterEqualFalsy,
	FILTER_OPERATIONS,
	FilterOperation,
	isFilterOperation,
	mergeFilterExpressions,
	resolveOperationLabel
} from "./filters";

type RowRecord = Record<string, unknown>;

describe("buildODataFilter", () => {
	it("экспортирует единый справочник операций фильтра", () => {
		expect(FILTER_OPERATIONS).toEqual(["eq", "ne", "gt", "ge", "lt", "le", "startswith", "endswith", "contains"]);
		expect(isFilterOperation("eq")).toBe(true);
		expect(isFilterOperation("between")).toBe(false);
		expect(resolveOperationLabel("contains")).toBe("содержит");
	});

	it("собирает базовые операции по типу значения", () => {
		expect(buildODataFilter<RowRecord>(createFilter("name", "O'Reilly", FilterOperation.eq))).toBe("name eq 'O''Reilly'");
		expect(buildODataFilter<RowRecord>(createFilter("amount", 10, FilterOperation.gt))).toBe("amount gt 10");
		expect(buildODataFilter<RowRecord>(createFilter("active", true, FilterOperation.ne))).toBe("active ne 'X'");
		expect(buildODataFilter<RowRecord>(createFilter("date", new Date(2026, 0, 2, 3, 4, 5), FilterOperation.ge))).toBe(
			"date ge datetime'2026-01-02T03:04:05'"
		);
	});

	it("собирает строковые OData functions", () => {
		expect(buildODataFilter<RowRecord>(createFilterContains("name", "сталь"))).toBe("substringof('сталь',name)");
		expect(buildODataFilter<RowRecord>(createFilter("name", "А", FilterOperation.startswith))).toBe("startswith(name, 'А')");
		expect(buildODataFilter<RowRecord>(createFilter("name", "Я", FilterOperation.endswith))).toBe("endswith(name, 'Я')");
	});

	it("собирает массив значений через OR и пропускает nullish-элементы", () => {
		expect(buildODataFilter<RowRecord>(createFilterEqual("code", ["A", null, "B"]))).toBe("(code eq 'A' or code eq 'B')");
		expect(buildODataFilter<RowRecord>(createFilterEqual("code", []))).toBe("");
		expect(buildODataFilter<RowRecord>(createFilterEqual("code", undefined))).toBe("");
	});

	it("собирает диапазон between и частичные границы", () => {
		expect(buildODataFilter<RowRecord>(createFilterBetween("amount", [10, 20]))).toBe("(amount ge 10 and amount le 20)");
		expect(buildODataFilter<RowRecord>(createFilterBetween("amount", [10, null]))).toBe("amount ge 10");
		expect(buildODataFilter<RowRecord>(createFilterBetween("amount", [null, 20]))).toBe("amount le 20");
		expect(buildODataFilter<RowRecord>(createFilterBetween("amount", null))).toBe("");
	});

	it("удаляет пустые вложенные группы перед сборкой", () => {
		const result = buildODataFilter<RowRecord>({
			and: true,
			filters: [{ filters: [] }, { and: true, filters: [] }]
		});

		expect(result).toBe("");
	});

	it("сохраняет непустые группы и игнорирует пустые", () => {
		const result = buildODataFilter<RowRecord>({
			and: true,
			filters: [{ filters: [] }, createFilterEqual<RowRecord, string>("name", "test")]
		});

		expect(result).toBe("name eq 'test'");
	});

	it("собирает вложенные группы и recursive-вариант с дополнительными скобками", () => {
		const expression = {
			and: false,
			filters: [
				{ and: true, conditions: [{ key: "amount", value: 10, operation: "gt" as const }] },
				{
					and: true,
					conditions: [
						{ key: "code", value: "A", operation: "eq" as const },
						{ key: "name", value: "Alpha", operation: "contains" as const }
					]
				}
			]
		};

		expect(buildODataFilter<RowRecord>(expression)).toBe("(amount gt 10 or (code eq 'A' and substringof('Alpha',name)))");
		expect(buildODataFilterRecursive<RowRecord>(expression)).toBe("((amount gt 10) or ((code eq 'A' and substringof('Alpha',name))))");
	});

	it("createFilterEqualFalsy намеренно отбрасывает falsy-значения", () => {
		expect(buildODataFilter<RowRecord>(createFilterEqualFalsy("amount", 0))).toBe("");
		expect(buildODataFilter<RowRecord>(createFilterEqualFalsy("amount", [0, 1]))).toBe("amount eq 1");
	});

	it("mergeFilterExpressions объединяет только существующие выражения через AND", () => {
		const left = createFilterEqual<RowRecord, string>("code", "A");
		const right = createFilterContains<RowRecord, string>("name", "Alpha");

		expect(mergeFilterExpressions(undefined, right)).toBe(right);
		expect(mergeFilterExpressions(left, undefined)).toBe(left);
		expect(buildODataFilter(mergeFilterExpressions(left, right))).toBe("(code eq 'A' and substringof('Alpha',name))");
	});
});
