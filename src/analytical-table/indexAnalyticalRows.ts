import { type AnalyticalModelRow, type AnalyticalTableModel } from "./types";

/** Единственный обход индексов полной и видимой проекций дерева. */
export function indexAnalyticalRows<T>(
	rows: readonly AnalyticalModelRow<T>[]
): Pick<AnalyticalTableModel<T>, "flatRows" | "visibleRows" | "rowById"> {
	const flatRows: AnalyticalModelRow<T>[] = [];
	const visibleRows: AnalyticalModelRow<T>[] = [];
	const rowById = new Map<string, AnalyticalModelRow<T>>();
	const visit = (nodes: readonly AnalyticalModelRow<T>[], visible: boolean): void => {
		for (const row of nodes) {
			flatRows.push(row);
			rowById.set(row.id, row);
			if (visible) visibleRows.push(row);
			visit(row.children, visible && row.isExpanded);
		}
	};
	visit(rows, true);
	return { flatRows, visibleRows, rowById };
}
