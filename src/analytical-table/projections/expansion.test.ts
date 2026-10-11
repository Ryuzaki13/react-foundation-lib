import { describe, expect, it, vi } from "vitest";

import { buildAnalyticalTableModel, projectAnalyticalTableExpansion, type AnalyticalModelRow, type AnalyticalTableModel } from "../index";

import { indexAnalyticalRows } from "./indexAnalyticalRows";

function createModel() {
	return buildAnalyticalTableModel({
		snapshot: {
			rows: [
				{ id: "root-a", values: { amount: 2 } },
				{ id: "branch-a", parentId: "root-a", values: { amount: 1 } },
				{ id: "leaf-a", parentId: "branch-a", values: { amount: 1 } },
				{ id: "direct-leaf", parentId: "root-a", values: { amount: 1 } },
				{ id: "root-b", values: { amount: 3 } },
				{ id: "leaf-b", parentId: "root-b", values: { amount: 3 } },
				{ id: "root-leaf", values: { amount: 0 } }
			]
		},
		columns: [{ id: "amount", aggregate: "sum" }]
	});
}

describe("проекция раскрытия", () => {
	it("возвращает исходную модель для того же эффективного раскрытия, листьев и неизвестных ID", () => {
		const model = createModel();
		expect(projectAnalyticalTableExpansion(model, [])).toBe(model);
		expect(projectAnalyticalTableExpansion(model, ["missing", "leaf-a", "root-leaf"])).toBe(model);
		const expanded = projectAnalyticalTableExpansion(model, ["root-a"]);
		expect(projectAnalyticalTableExpansion(expanded, ["root-a", "root-a", "leaf-b", "missing"])).toBe(expanded);
	});
	it("заменяет раскрываемый узел, сохраняя его детей и независимые ветви по ссылке", () => {
		const model = createModel();
		const projected = projectAnalyticalTableExpansion(model, ["root-a"]);
		expect(projected).not.toBe(model);
		expect(projected.rows).not.toBe(model.rows);
		expect(projected.rows[0]).not.toBe(model.rows[0]);
		expect(projected.rows[0].children).toBe(model.rows[0].children);
		expect(projected.rows[1]).toBe(model.rows[1]);
		expect(projected.rows[2]).toBe(model.rows[2]);
		expect(projected.visibleRows.map((row) => row.id)).toEqual(["root-a", "branch-a", "direct-leaf", "root-b", "root-leaf"]);
		expect(projected.grandTotals).toBe(model.grandTotals);
		expect(projected.columns).toBe(model.columns);
		expect(projected.diagnostics).toBe(model.diagnostics);
		expect(model.rows[0].isExpanded).toBe(false);
	});
	it("обновляет предков скрытой ветви и все индексы ссылаются на новые узлы", () => {
		const model = createModel();
		const projected = projectAnalyticalTableExpansion(model, ["branch-a"]);
		const root = projected.rows[0];
		const branch = root.children[0];
		expect(root).not.toBe(model.rows[0]);
		expect(root.isExpanded).toBe(false);
		expect(branch).not.toBe(model.rows[0].children[0]);
		expect(branch.isExpanded).toBe(true);
		expect(branch.children).toBe(model.rows[0].children[0].children);
		expect(root.children[1]).toBe(model.rows[0].children[1]);
		expect(projected.rows[1]).toBe(model.rows[1]);
		expect(projected.flatRows[0]).toBe(root);
		expect(projected.flatRows[1]).toBe(branch);
		expect(projected.visibleRows[0]).toBe(root);
		expect(projected.rowById.get("root-a")).toBe(root);
		expect(projected.rowById.get("branch-a")).toBe(branch);
		for (const row of projected.flatRows) expect(projected.rowById.get(row.id)).toBe(row);
		expect(projected.visibleRows.map((row) => row.id)).toEqual(model.visibleRows.map((row) => row.id));
	});
	it("all эквивалентен полному списку раскрываемых узлов и не раскрывает листья", () => {
		const model = createModel();
		const expanded = projectAnalyticalTableExpansion(model, "all");
		expect(expanded.visibleRows.map((row) => row.id)).toEqual(expanded.flatRows.map((row) => row.id));
		expect(expanded.rowById.get("leaf-a")?.isExpanded).toBe(false);
		expect(projectAnalyticalTableExpansion(expanded, "all")).toBe(expanded);
		expect(projectAnalyticalTableExpansion(expanded, ["root-b", "root-a", "branch-a", "unknown"])).toBe(expanded);
		const collapsed = projectAnalyticalTableExpansion(expanded, []);
		expect(collapsed.flatRows.every((row) => !row.isExpanded)).toBe(true);
		expect(collapsed.rowById.get("leaf-a")).toBe(model.rowById.get("leaf-a"));
		expect(projectAnalyticalTableExpansion(collapsed, [])).toBe(collapsed);
	});
	it("не вычисляет формулы или итоги повторно", () => {
		const compute = vi.fn(() => 1);
		const aggregate = vi.fn(() => ({ computed: 3 }));
		const model = buildAnalyticalTableModel({
			snapshot: {
				rows: [
					{ id: "root", values: {} },
					{ id: "child", parentId: "root", values: {} }
				]
			},
			columns: [{ id: "computed", calculate: { dependencies: [], compute } }],
			aggregate
		});
		const computeCount = compute.mock.calls.length;
		const aggregateCount = aggregate.mock.calls.length;
		const expanded = projectAnalyticalTableExpansion(model, "all");
		projectAnalyticalTableExpansion(expanded, []);
		expect(compute).toHaveBeenCalledTimes(computeCount);
		expect(aggregate).toHaveBeenCalledTimes(aggregateCount);
		expect(expanded.grandTotals).toBe(model.grandTotals);
	});
	it("индексирует и раскрывает глубокую готовую модель без рекурсивного стека", () => {
		// Здесь проверяется именно проекция готовой модели, независимо от построителя исходной иерархии.
		const depth = 5_000;
		let rows: readonly AnalyticalModelRow[] = [];
		for (let index = depth - 1; index >= 0; index--) {
			rows = [
				{
					id: String(index),
					parentId: index === 0 ? null : String(index - 1),
					kind: "data",
					values: {},
					level: index,
					children: rows,
					isExpandable: rows.length > 0,
					isExpanded: false
				}
			];
		}
		const model: AnalyticalTableModel = {
			columns: [],
			rows,
			...indexAnalyticalRows(rows),
			grandTotals: null,
			diagnostics: { orphanRowIds: [], duplicateRowIds: [], cyclicRowIds: [] }
		};
		expect(model.visibleRows).toHaveLength(1);
		const projected = projectAnalyticalTableExpansion(model, "all");
		expect(projected.flatRows).toHaveLength(depth);
		expect(projected.visibleRows).toHaveLength(depth);
		expect(projected.rowById.get(String(depth - 1))).toBe(model.rowById.get(String(depth - 1)));
		expect(projectAnalyticalTableExpansion(projected, "all")).toBe(projected);
	});
});
