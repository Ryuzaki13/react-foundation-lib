import { describe, expect, it } from "vitest";

import { buildAnalyticalTableModel, projectAnalyticalTableExport } from "./index";

const model = buildAnalyticalTableModel({
	snapshot: {
		rows: [
			{ id: "root", values: { value: 2 } },
			{ id: "child", parentId: "root", values: { value: 1 } }
		]
	},
	columns: [{ id: "value", label: "Значение", aggregate: "sum" }],
	state: { grouping: [{ id: "by-value", keyColumnIds: ["value"] }] }
});

describe("проекция экспорта", () => {
	it("all содержит свёрнутые дочерние строки, selected сохраняет порядок дерева", () => {
		expect(projectAnalyticalTableExport({ model }).rows.map((row) => row.id)).toEqual([model.rows[0].id, "root", "child"]);
		expect(
			projectAnalyticalTableExport({ model, scope: "selected", selectedRowIds: ["child", "root"] }).rows.map((row) => row.id)
		).toEqual(["root", "child"]);
	});
	it("visible соответствует раскрытию, includeGroups убирает только синтетические строки", () => {
		expect(projectAnalyticalTableExport({ model, scope: "visible" }).rows).toHaveLength(1);
		expect(projectAnalyticalTableExport({ model, includeGroups: false }).rows.map((row) => row.id)).toEqual(["root", "child"]);
	});
	it("сохраняет порядок столбцов, raw numeric значения и форматирует явно", () => {
		const result = projectAnalyticalTableExport({
			model,
			columns: [{ id: "value", label: "Количество", format: (value, row) => `${row.level}:${value}` }],
			includeGrandTotals: true
		});
		expect(result.columns).toEqual([{ id: "value", label: "Количество" }]);
		expect(result.rows[1].values).toEqual(["1:2"]);
		expect(result.rows.at(-1)).toMatchObject({ kind: "grand", values: [2] });
	});
	it("форматирует общий итог отдельным callback без вымышленной строки исходного дерева", () => {
		const result = projectAnalyticalTableExport({
			model,
			columns: [
				{ id: "value", format: (value, row) => `${row.id}: ${String(value)}`, formatTotal: (value) => `${String(value)} единиц` }
			],
			includeGrandTotals: true
		});
		expect(result.rows.find((item) => item.id === "root")?.values).toEqual(["root: 2"]);
		expect(result.rows.at(-1)).toMatchObject({ kind: "grand", values: ["2 единиц"] });
	});
});
