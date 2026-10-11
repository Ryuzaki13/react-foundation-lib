import { type AnalyticalModelRow, type AnalyticalTableModel } from "../types";

type RowTraversalFrame<T> = {
	readonly rows: readonly AnalyticalModelRow<T>[];
	readonly visible: boolean;
	nextIndex: number;
};

/** Строит согласованные индексы за один проход, не расходуя стек вызовов на глубину дерева. */
export function indexAnalyticalRows<T>(
	rows: readonly AnalyticalModelRow<T>[]
): Pick<AnalyticalTableModel<T>, "flatRows" | "visibleRows" | "rowById"> {
	const flatRows: AnalyticalModelRow<T>[] = [];
	const visibleRows: AnalyticalModelRow<T>[] = [];
	const rowById = new Map<string, AnalyticalModelRow<T>>();
	const stack: RowTraversalFrame<T>[] = [{ rows, visible: true, nextIndex: 0 }];

	while (stack.length > 0) {
		const frame = stack[stack.length - 1];
		if (frame.nextIndex === frame.rows.length) {
			stack.pop();
			continue;
		}
		const row = frame.rows[frame.nextIndex++];
		flatRows.push(row);
		rowById.set(row.id, row);
		if (frame.visible) visibleRows.push(row);
		if (row.children.length > 0) {
			stack.push({ rows: row.children, visible: frame.visible && row.isExpanded, nextIndex: 0 });
		}
	}
	return { flatRows, visibleRows, rowById };
}
