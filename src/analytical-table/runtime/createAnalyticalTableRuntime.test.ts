import { describe, expect, it, vi } from "vitest";

import { compileAnalyticalTableDefinition, createAnalyticalTableRuntime, type AnalyticalDataRow, type AnalyticalViewState } from "../index";

const rows: readonly AnalyticalDataRow[] = [
	{ id: "b", values: { unit: "B", value: 3 } },
	{ id: "b-child", parentId: "b", values: { unit: "B", value: 100 } },
	{ id: "a", values: { unit: "A", value: 2 } }
];
const grouping = [{ id: "unit", keyColumnIds: ["unit"] }];

function setupRuntime() {
	const compute = vi.fn((values: Readonly<Record<string, unknown>>) => Number(values.value) * 2);
	const aggregate = vi.fn(() => ({}));
	const definition = compileAnalyticalTableDefinition({
		columns: [{ id: "unit" }, { id: "double", aggregate: "sum", calculate: { dependencies: ["value"], compute } }],
		dataFields: [{ id: "value", aggregate: "sum" }],
		aggregate
	});
	const runtime = createAnalyticalTableRuntime({ definition, snapshot: { rows } });

	return { definition, runtime, compute, aggregate };
}

describe("runtime одного аналитического снимка", () => {
	it("служебные поля участвуют в вычислениях и итогах без добавления отображаемых колонок", () => {
		const { runtime } = setupRuntime();
		const model = runtime.getModel({ grouping });

		expect(model.columns.map((column) => column.id)).toEqual(["unit", "double"]);
		expect(model.grandTotals).toEqual({ value: 5, double: 10 });
		expect(model.rowById.get("b-child")?.values.double).toBe(200);
		expect(model.rows[0].values).toEqual({ unit: "B", value: 3, double: 6 });
		expect(rows[0].values).not.toHaveProperty("double");
	});

	it("сортировка и раскрытие переиспользуют расчёт снимка и итоги; очистка восстанавливает исходный порядок", () => {
		const { runtime, compute, aggregate } = setupRuntime();
		const initial = runtime.getModel({ grouping });
		const calls = { compute: compute.mock.calls.length, aggregate: aggregate.mock.calls.length };
		const sorted = runtime.getModel({ grouping, sorting: [{ id: "unit" }] });
		const expanded = runtime.getModel({ grouping, sorting: [{ id: "unit" }], expandedRowIds: "all" });

		expect(sorted.rows.map((row) => row.values.unit)).toEqual(["A", "B"]);
		expect(expanded.visibleRows).toHaveLength(5);
		expect(expanded.grandTotals).toBe(initial.grandTotals);
		expect(compute).toHaveBeenCalledTimes(calls.compute);
		expect(aggregate).toHaveBeenCalledTimes(calls.aggregate);
		expect(runtime.getModel({ grouping }).rows.map((row) => row.values.unit)).toEqual(["B", "A"]);
	});

	it("новые фильтры и группировки пересчитывают итоги, сохраняя исходные вычисленные строки", () => {
		const { runtime, compute, aggregate } = setupRuntime();
		const initial = runtime.getModel();
		const filters = [{ id: "unit", value: "B" }];
		const filtered = runtime.getModel({ filters });
		const grouped = runtime.getModel({ filters, grouping });

		expect(filtered.flatRows.map((row) => row.id)).toEqual(["b", "b-child"]);
		expect(filtered.grandTotals).toEqual({ value: 3, double: 6 });
		expect(grouped.rows[0].values).toEqual({ unit: "B", value: 3, double: 6 });
		expect(grouped.rowById.get("b")?.sourceRow).toBe(initial.rowById.get("b")?.sourceRow);
		expect(compute).toHaveBeenCalledTimes(rows.length);
		expect(aggregate).toHaveBeenCalledTimes(4);
	});

	it("сворачивание одной ветки сохраняет объекты остальных раскрытых строк", () => {
		const definition = compileAnalyticalTableDefinition({ columns: [{ id: "unit" }] });
		const runtime = createAnalyticalTableRuntime({
			definition,
			snapshot: { rows: [...rows, { id: "a-child", parentId: "a", values: { unit: "A" } }] }
		});
		const expanded = runtime.getModel({ grouping, expandedRowIds: "all" });
		const expandedRowIds = expanded.flatRows.filter((row) => row.isExpandable && row.id !== "b").map((row) => row.id);
		const collapsed = runtime.getModel({ grouping, expandedRowIds });
		const changedIds = collapsed.flatRows.filter((row) => row !== expanded.rowById.get(row.id)).map((row) => row.id);

		expect(changedIds).toEqual([expanded.rowById.get("b")!.parentId, "b"]);
		expect(collapsed.visibleRows.map((row) => row.id)).not.toContain("b-child");
		expect(collapsed.visibleRows.map((row) => row.id)).toContain("a-child");
		expect(expanded.rowById.get("b")?.isExpanded).toBe(true);
	});

	it("повторный запрос состояния возвращает ту же модель, а runtime другого снимка изолирован", () => {
		const { definition, runtime, compute } = setupRuntime();
		const state: AnalyticalViewState = { grouping, expandedRowIds: ["b"] };
		const initial = runtime.getModel(state);

		expect(runtime.getModel({ ...state })).toBe(initial);
		const another = createAnalyticalTableRuntime({
			definition,
			snapshot: { rows: [{ id: "different", values: { unit: "C", value: 9 } }] }
		});
		expect(another.getModel().grandTotals).toEqual({ value: 9, double: 18 });
		expect(runtime.getModel(state)).toBe(initial);
		expect(compute).toHaveBeenCalledTimes(rows.length + 1);
	});

	it("ошибка позднего этапа не подменяет ранее рассчитанное состояние", () => {
		let fail = false;
		const definition = compileAnalyticalTableDefinition({
			columns: [
				{ id: "unit" },
				{
					id: "value",
					aggregate: "sum",
					compare: (left, right) => {
						if (fail) throw new Error("Сбой сравнения");
						return Number(left) - Number(right);
					}
				}
			]
		});
		const runtime = createAnalyticalTableRuntime({ definition, snapshot: { rows } });
		const initial = runtime.getModel();
		const nextState: AnalyticalViewState = { grouping, sorting: [{ id: "value" }] };

		fail = true;
		expect(() => runtime.getModel(nextState)).toThrow("Сбой сравнения");
		expect(runtime.getModel()).toBe(initial);
		fail = false;
		const recovered = runtime.getModel(nextState);
		expect(recovered.rows.map((row) => row.values.unit)).toEqual(["A", "B"]);
		expect(recovered.grandTotals).toEqual({ value: 5 });
	});

	it("повторный ID не меняет выбранную зернистость первой исходной строки", () => {
		const definition = compileAnalyticalTableDefinition({
			columns: [{ id: "value", aggregate: "sum" }],
			isAggregateRow: (row) => row.values.include === true
		});
		const runtime = createAnalyticalTableRuntime({
			definition,
			snapshot: {
				rows: [
					{ id: "same", values: { value: 2, include: false } },
					{ id: "same", values: { value: 20, include: true } }
				]
			}
		});

		expect(runtime.getModel().grandTotals).toEqual({ value: null });
		expect(runtime.getModel().diagnostics.duplicateRowIds).toEqual(["same"]);
	});
});
