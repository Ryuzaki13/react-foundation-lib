import { type AnalyticalModelRow, type AnalyticalTableModel } from "../types";

import { indexAnalyticalRows } from "./indexAnalyticalRows";

/** Любая проекция дерева заменяет индексы вместе с узлами, сохраняя уже рассчитанные итоги. */
export function resolveRowsProjection<T>(model: AnalyticalTableModel<T>, rows: readonly AnalyticalModelRow<T>[]): AnalyticalTableModel<T> {
	if (rows === model.rows) return model;
	return { ...model, rows, ...indexAnalyticalRows(rows) };
}
