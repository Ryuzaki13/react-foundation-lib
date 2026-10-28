import { ANALYTICAL_EXPANSION_ALL } from "../runtime/analyticalViewConstants";
import { type AnalyticalModelRow, type AnalyticalTableModel } from "../types";

import { resolveRowsProjection } from "./resolveRowsProjection";

/** Копирует массив только при замене его непосредственного ребёнка. */
function replaceExpandedRows<T>(
	rows: readonly AnalyticalModelRow<T>[],
	replacements: ReadonlyMap<AnalyticalModelRow<T>, AnalyticalModelRow<T>>
): readonly AnalyticalModelRow<T>[] {
	let projected: AnalyticalModelRow<T>[] | undefined;
	for (let index = 0; index < rows.length; index++) {
		const replacement = replacements.get(rows[index]);
		if (!replacement) continue;
		projected ??= rows.slice();
		projected[index] = replacement;
	}
	return projected ?? rows;
}

/** Раскрытие меняет только затронутые ветви; формулы и итоги остаются результатом базовой модели. */
export function projectAnalyticalTableExpansion<T>(
	model: AnalyticalTableModel<T>,
	expandedRowIds: readonly string[] | typeof ANALYTICAL_EXPANSION_ALL
): AnalyticalTableModel<T> {
	const expandAll = expandedRowIds === ANALYTICAL_EXPANSION_ALL;
	const expanded = new Set(expandAll ? [] : expandedRowIds);
	const replacements = new Map<AnalyticalModelRow<T>, AnalyticalModelRow<T>>();

	// flatRows уже содержит обход родитель → дети. Обратный проход позволяет
	// заменить ребёнка до родителя без рекурсии и сохранить ссылки остальных ветвей.
	for (let index = model.flatRows.length - 1; index >= 0; index--) {
		const row = model.flatRows[index];
		const children = replaceExpandedRows(row.children, replacements);
		const isExpanded = row.isExpandable && (expandAll || expanded.has(row.id));
		if (isExpanded !== row.isExpanded || children !== row.children) {
			replacements.set(row, { ...row, isExpanded, children });
		}
	}

	// Неизвестные ID и листья не меняют эффективное раскрытие и не сбрасывают memo потребителей.
	if (replacements.size === 0) return model;
	return resolveRowsProjection(model, replaceExpandedRows(model.rows, replacements));
}
