import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { collectFilterableColumns, collectFilterableColumnsIds } from "./columns";
import { isBooleanSafe, isDateSafe, isNumberSafe, isStringSafe, odataTypeSchemas } from "./schema";
import { buildODataOrder, buildODataOrderBy, getSortIndicator, resolveEffectiveSorts, toggleSort } from "./sorts";
import type { EntityColumnProperty } from "./types";
import { unwrapODataQueryResult } from "./unwrapODataQueryResult";
import { isBaseValue, normalizeBaseValue, normalizeRangeValue } from "./utils";
import { unwrapODataParams, wrapODataParams } from "./wrapParams";

type QueryEnvelope<T> = {
	data: T;
	totalCount?: number;
};

function column(overrides: Partial<EntityColumnProperty>): EntityColumnProperty {
	return {
		id: "id",
		label: "Колонка",
		type: "string",
		originalType: "Edm.String",
		semanticType: "none",
		sortable: true,
		filterable: false,
		role: "dimension",
		...overrides
	};
}

describe("odata-service columns", () => {
	it("собирает только filterable code-like колонки", () => {
		const columns = [
			column({ id: "code", semanticType: "code", filterable: true }),
			column({ id: "text", semanticType: "text", filterable: true }),
			column({ id: "disabled", semanticType: "code", filterable: false })
		];

		expect(collectFilterableColumns(columns).map((item) => item.id)).toEqual(["code"]);
		expect(collectFilterableColumnsIds(columns)).toEqual(new Set(["code"]));
	});
});

describe("odata-service value utils", () => {
	it("нормализует range к паре значений", () => {
		const date = new Date("2026-07-03T00:00:00.000Z");

		expect(normalizeRangeValue(["A"])).toEqual(["A", null]);
		expect(normalizeRangeValue(date)).toEqual([date, null]);
		expect(normalizeRangeValue({ value: "A" })).toEqual([null, null]);
	});

	it("нормализует base value и отсекает составные значения", () => {
		const date = new Date("2026-07-03T00:00:00.000Z");

		expect(normalizeBaseValue(date)).toBe(date);
		expect(normalizeBaseValue("A")).toBe("A");
		expect(normalizeBaseValue(["A"])).toBeNull();
		expect(normalizeBaseValue({ value: "A" })).toBeNull();
		expect(isBaseValue(false)).toBe(true);
		expect(isBaseValue({})).toBe(false);
	});
});

describe("odata-service sorting", () => {
	type Row = { code: string; amount: number; group: string };

	it("собирает OData order и переключает сортировку по циклу asc-desc-remove", () => {
		let sorting = toggleSort<Row>([], "code", false);
		expect(sorting).toEqual([{ key: "code" }]);

		sorting = toggleSort<Row>(sorting, "code", false);
		expect(sorting).toEqual([{ key: "code", desc: true }]);

		sorting = toggleSort<Row>(sorting, "code", false);
		expect(sorting).toEqual([]);

		expect(buildODataOrder<Row>([{ key: "amount", desc: true }, { key: "code" }])).toBe("amount desc,code asc");
	});

	it("использует группировки как fallback-сортировку", () => {
		expect(resolveEffectiveSorts<Row["group"]>(["group"], [])).toEqual([{ key: "group" }]);
		expect(buildODataOrderBy<Row>(["group"], [])).toBe("group asc");
		expect(getSortIndicator<Row>(["group"], [], "group")).toEqual({ active: true, order: 1, lockedByGrouping: true });
		expect(getSortIndicator<Row>([], [{ key: "amount", desc: true }], "amount")).toEqual({
			active: true,
			desc: true,
			order: 1
		});
	});
});

describe("odata-service schemas", () => {
	it("валидирует базовые типы через zod-схемы", () => {
		expect(isStringSafe("A")).toBe(true);
		expect(isNumberSafe(1.5)).toBe(true);
		expect(isBooleanSafe(false)).toBe(true);
		expect(isDateSafe(new Date())).toBe(true);
		expect(isDateSafe("2026-07-03")).toBe(false);
		expect(odataTypeSchemas.byte.safeParse(256).success).toBe(false);
		expect(odataTypeSchemas.byte.safeParse(255).success).toBe(true);
	});
});

describe("odata-service params", () => {
	it("оборачивает flat params без потери nullish-значений", () => {
		expect(wrapODataParams({ p_a: "A", p_empty: null, p_flag: false })).toEqual({
			p_a: { value: "A" },
			p_empty: { value: null },
			p_flag: { value: false }
		});
		expect(wrapODataParams(undefined)).toEqual({});
	});

	it("распаковывает params в стабильном порядке ключей", () => {
		expect(unwrapODataParams({ p_b: { value: "B" }, p_a: { value: undefined } })).toEqual({
			p_a: null,
			p_b: "B"
		});
		expect(unwrapODataParams()).toBeUndefined();
	});
});

describe("unwrapODataQueryResult", () => {
	it("выносит data и totalCount из envelope, сохраняя остальные поля query", () => {
		const query = {
			data: { data: ["A", "B"], totalCount: 2 },
			status: "success"
		} as UseQueryResult<QueryEnvelope<string[]>>;

		expect(unwrapODataQueryResult(query)).toMatchObject({
			data: ["A", "B"],
			totalCount: 2,
			status: "success"
		});
	});
});
