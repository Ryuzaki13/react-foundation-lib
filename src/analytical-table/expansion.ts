import { indexAnalyticalRows } from "./indexAnalyticalRows";
import { type AnalyticalModelRow, type AnalyticalTableModel } from "./types";

/** Раскрытие не меняет группировки, формулы и итоги; UI мемоизирует базовую модель отдельно. */
export function projectAnalyticalTableExpansion<T>(
	model: AnalyticalTableModel<T>,
	expandedRowIds: readonly string[] | "all"
): AnalyticalTableModel<T> {
	const expanded = new Set(expandedRowIds === "all" ? [] : expandedRowIds);
	const project = (nodes: readonly AnalyticalModelRow<T>[]): AnalyticalModelRow<T>[] =>
		nodes.map((node) => ({
			...node,
			isExpanded: node.isExpandable && (expandedRowIds === "all" || expanded.has(node.id)),
			children: project(node.children)
		}));
	const rows = project(model.rows);
	return { ...model, rows, ...indexAnalyticalRows(rows) };
}
