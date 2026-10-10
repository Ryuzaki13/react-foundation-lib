import { describe, expect, it, vi } from "vitest";

import { buildAnalyticalTableModel, projectAnalyticalTableExpansion } from "./index";
import { type AnalyticalColumn, type AnalyticalDataRow, type AnalyticalSnapshot } from "./index";

type Original = Readonly<{ kind: "meeting" | "student" }>;
const row = (id: string, values: Record<string, unknown>, parentId?: string): AnalyticalDataRow<Original> => ({
	id,
	parentId,
	values,
	original: { kind: parentId ? "student" : "meeting" }
});
const columns: readonly AnalyticalColumn<Original>[] = [
	{ id: "unit" },
	{ id: "year" },
	{ id: "unitName" },
	{ id: "name" },
	{ id: "present", kind: "measure", aggregate: "sum" },
	{ id: "total", kind: "measure", aggregate: "sum" },
	{
		id: "percent",
		kind: "measure",
		calculate: {
			dependencies: ["present", "total"],
			compute: (values) => (Number(values.total) > 0 ? (Number(values.present) * 100) / Number(values.total) : null)
		}
	}
];
const snapshot: AnalyticalSnapshot<Original> = {
	rows: [
		row("m1", { unit: 2, year: 2026, unitName: "Отделение 2", name: "Б", present: 1, total: 2 }),
		row("s1", { name: "З", present: 1, total: 1 }, "m1"),
		row("s2", { name: "А", present: 0, total: 1 }, "m1"),
		row("m2", { unit: 2, year: 2026, unitName: "Отделение 2", name: "А", present: 9, total: 10 }),
		row("m3", { unit: 2, year: 2025, unitName: "Отделение 2", name: "В", present: 0, total: 0 })
	]
};

describe("buildAnalyticalTableModel", () => {
	it("группирует составной ключ над готовыми деревьями и не удваивает меры детей", () => {
		const model = buildAnalyticalTableModel({
			snapshot,
			columns,
			state: {
				grouping: [{ id: "unit-year", keyColumnIds: ["unit", "year"], displayColumnIds: ["unitName"] }],
				expandedRowIds: "all"
			}
		});
		expect(model.rows).toHaveLength(2);
		expect(model.rows[0].values).toMatchObject({ present: 10, total: 12, percent: 1000 / 12, unitName: "Отделение 2" });
		expect(model.rows[0].children[0].children.map((item) => item.id)).toEqual(["s1", "s2"]);
		expect(model.rows[1].children[0].id).toBe("m3");
		expect(model.grandTotals).toMatchObject({ present: 10, total: 12, percent: 1000 / 12 });
		expect(model.visibleRows).toHaveLength(7);
		expect(snapshot.rows[0].values).not.toHaveProperty("percent");
	});
	it("сортирует только соседей и сохраняет идентичность групп при изменении порядка", () => {
		const state = { grouping: [{ id: "unit", keyColumnIds: ["unit"] }] };
		const initial = buildAnalyticalTableModel({ snapshot, columns, state });
		const sorted = buildAnalyticalTableModel({ snapshot, columns, state: { ...state, sorting: [{ id: "name" }] } });
		expect(sorted.rows[0].id).toBe(initial.rows[0].id);
		expect(sorted.rows[0].children.map((item) => item.id)).toEqual(["m2", "m1", "m3"]);
		expect(sorted.rowById.get("m1")?.children.map((item) => item.id)).toEqual(["s2", "s1"]);
	});
	it("при совпадении родителя сохраняет детей, при совпадении ребёнка — путь", () => {
		const parent = buildAnalyticalTableModel({ snapshot, columns, state: { filters: [{ id: "name", value: "Б" }] } });
		expect(parent.flatRows.map((item) => item.id)).toEqual(["m1", "s1", "s2"]);
		const child = buildAnalyticalTableModel({ snapshot, columns, state: { filters: [{ id: "name", value: "З" }] } });
		expect(child.flatRows.map((item) => item.id)).toEqual(["m1", "s1"]);
	});
	it("общие итоги all сохраняются при фильтре, filtered учитывают оставшиеся корни", () => {
		const state = { filters: [{ id: "name", value: "Б" }] };
		expect(buildAnalyticalTableModel({ snapshot, columns, state }).grandTotals?.total).toBe(2);
		expect(buildAnalyticalTableModel({ snapshot, columns, state, grandTotalsScope: "all" }).grandTotals?.total).toBe(12);
	});
	it("callback получает только заданную зернистость, включая пустые корни", () => {
		const aggregate = vi.fn((context: { rows: readonly AnalyticalDataRow<Original>[] }) => ({ meetings: context.rows.length }));
		const model = buildAnalyticalTableModel({
			snapshot,
			columns,
			isAggregateRow: (item) => item.original?.kind === "meeting",
			aggregate
		});
		expect(model.grandTotals?.meetings).toBe(3);
		expect(aggregate.mock.calls[0][0].rows.map((item) => item.id)).toEqual(["m1", "m2", "m3"]);
	});
	it("раскрытие не вычисляет формулы и итоги повторно", () => {
		const compute = vi.fn(() => 1);
		const model = buildAnalyticalTableModel({ snapshot, columns: [{ id: "computed", calculate: { dependencies: [], compute } }] });
		const count = compute.mock.calls.length;
		const expanded = projectAnalyticalTableExpansion(model, ["m1"]);
		expect(expanded.visibleRows).toHaveLength(5);
		expect(model.visibleRows).toHaveLength(3);
		expect(compute).toHaveBeenCalledTimes(count);
		expect(expanded.grandTotals).toBe(model.grandTotals);
		expect(expanded.rowById.get("m1")?.values).toBe(model.rowById.get("m1")?.values);
	});
	it("различает null, undefined, строковые и числовые ключи", () => {
		const rows = [null, undefined, "1", 1].map((unit, index) => row(String(index), { unit }));
		const model = buildAnalyticalTableModel({
			snapshot: { rows },
			columns,
			state: { grouping: [{ id: "unit", keyColumnIds: ["unit"] }] }
		});
		expect(new Set(model.rows.map((item) => item.id)).size).toBe(4);
	});
	it("передаёт диагностику hierarchy из существующего tree-table", () => {
		const model = buildAnalyticalTableModel({
			snapshot: { rows: [row("orphan", {}, "missing"), row("cycle", {}, "cycle"), row("orphan", {})] },
			columns: []
		});
		expect(model.diagnostics).toEqual({ orphanRowIds: ["orphan"], duplicateRowIds: ["orphan"], cyclicRowIds: ["cycle"] });
		expect(model.flatRows.map((item) => item.id)).toEqual(["orphan", "cycle"]);
	});
	it("не теряет равные строки при стабильной сортировке и отклоняет неизвестный столбец", () => {
		const same = { rows: [row("b", { name: "same" }), row("a", { name: "same" })] };
		expect(
			buildAnalyticalTableModel({ snapshot: same, columns, state: { sorting: [{ id: "name" }] } }).flatRows.map((item) => item.id)
		).toEqual(["b", "a"]);
		expect(() => buildAnalyticalTableModel({ snapshot, columns, state: { sorting: [{ id: "unknown" }] } })).toThrow("Неизвестный");
	});
	it("пустой снимок даёт устойчивую пустую модель без деления на ноль", () => {
		const model = buildAnalyticalTableModel({ snapshot: { rows: [] }, columns });
		expect(model.visibleRows).toEqual([]);
		expect(model.grandTotals).toEqual({ present: null, total: null, percent: null });
	});
	it("сохраняет явную сумму вычисленной колонки и использует её в зависимых итоговых формулах", () => {
		const model = buildAnalyticalTableModel({
			snapshot: { rows: [row("a", { unit: 1, quantity: 2, price: 3 }), row("b", { unit: 1, quantity: 4, price: 5 })] },
			columns: [
				{ id: "quantity", aggregate: "sum" },
				{ id: "price" },
				{
					id: "amount",
					aggregate: "sum",
					calculate: { dependencies: ["quantity", "price"], compute: (values) => Number(values.quantity) * Number(values.price) }
				},
				{
					id: "averagePrice",
					calculate: {
						dependencies: ["amount", "quantity"],
						compute: (values) => Number(values.amount) / Number(values.quantity)
					}
				}
			],
			state: { grouping: [{ id: "unit", keyColumnIds: ["unit"] }] }
		});
		expect(model.rows[0].children.map((item) => item.values.amount)).toEqual([6, 20]);
		expect(model.rows[0].values).toMatchObject({ quantity: 6, amount: 26, averagePrice: 26 / 6 });
		expect(model.grandTotals).toEqual({ quantity: 6, amount: 26, averagePrice: 26 / 6 });
	});
	it("callback итогов и вычисленные ключи группировки не перезаписываются построчным расчётом", () => {
		const computedColumns: AnalyticalColumn<Original>[] = [
			{ id: "value" },
			{ id: "band", calculate: { dependencies: ["value"], compute: (values) => (Number(values.value) > 1 ? "high" : "low") } },
			{ id: "amount", calculate: { dependencies: ["value"], compute: (values) => Number(values.value) * 10 } }
		];
		const model = buildAnalyticalTableModel({
			snapshot: { rows: [row("a", { value: 2 }), row("b", { value: 3 })] },
			columns: computedColumns,
			state: { grouping: [{ id: "band", keyColumnIds: ["band"] }] },
			aggregate: () => ({ amount: null })
		});
		expect(model.rows[0].values).toMatchObject({ band: "high", amount: null });
		expect(model.grandTotals?.amount).toBeNull();
	});
});

it("группировка использует скрытый identity без технического UI-столбца", () => {
	const model = buildAnalyticalTableModel({
		snapshot: { rows: [row("m1", { hiddenId: 1, label: "Первый", total: 2 }), row("m2", { hiddenId: 1, label: "Первый", total: 3 })] },
		columns: [{ id: "total", aggregate: "sum" }],
		state: { grouping: [{ id: "hidden", keyColumnIds: ["hiddenId"], displayColumnIds: ["label"] }] }
	});
	expect(model.rows).toHaveLength(1);
	expect(model.rows[0].values).toEqual({ hiddenId: 1, label: "Первый", total: 5 });
});
