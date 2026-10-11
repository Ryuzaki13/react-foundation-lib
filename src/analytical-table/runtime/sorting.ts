import { type AnalyticalColumn } from "../definition/types";
import { resolveRowsProjection } from "../projections/resolveRowsProjection";

import { type AnalyticalModelRow, type AnalyticalSorting, type AnalyticalTableModel } from "./types";
import { compareAnalyticalValues } from "./valueComparison";

/** Меняет только порядок соседей: вычисленные значения, итоги и связи parent/child сохраняются. */
export function sortAnalyticalModel<T>(
	model: AnalyticalTableModel<T>,
	sorting: readonly AnalyticalSorting[],
	fieldsById: ReadonlyMap<string, AnalyticalColumn<T>>
): AnalyticalTableModel<T> {
	if (sorting.length === 0) return model;

	const compareRows = (left: AnalyticalModelRow<T>, right: AnalyticalModelRow<T>): number => {
		for (const sort of sorting) {
			const comparison = compareAnalyticalValues(left.values[sort.id], right.values[sort.id], fieldsById.get(sort.id));
			if (comparison !== 0) return sort.desc ? -comparison : comparison;
		}
		return 0;
	};
	const sortBranch = (rows: readonly AnalyticalModelRow<T>[]): readonly AnalyticalModelRow<T>[] => {
		if (rows.length === 0) return rows;

		const projected = rows.map((row) => {
			const children = sortBranch(row.children);
			return children === row.children ? row : { ...row, children };
		});
		projected.sort(compareRows);

		return projected.every((row, index) => row === rows[index]) ? rows : projected;
	};

	return resolveRowsProjection(model, sortBranch(model.rows));
}
