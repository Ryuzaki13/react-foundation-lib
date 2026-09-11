import { moveArrayItemByIndex } from "../array";

import { type TableDocument } from "./tableDocument";
import { assertTableDocument } from "./tableDocumentGeometry";

/** Неразрывная группа строк/столбцов; применима к reorder и подтверждению удаления. */
export type TableDocumentAxisGroup = { readonly start: number; readonly count: number };

/** Находит безопасные границы без случайных ID и без повторного учёта скрытых spans. */
export function getTableDocumentAxisGroups<T>(document: TableDocument<T>, axis: "row" | "column"): readonly TableDocumentAxisGroup[] {
	assertTableDocument(document);
	const length = axis === "row" ? document.rows.length : document.columns.length;
	const blocked = new Set<number>();
	for (const merge of document.merges) {
		const span = axis === "row" ? merge.rowSpan : merge.columnSpan;
		for (let offset = 1; offset < span; offset++) blocked.add(merge[axis] + offset);
	}
	const groups: TableDocumentAxisGroup[] = [];
	let start = 0;
	for (let i = 1; i <= length; i++) {
		if (i === length || !blocked.has(i)) {
			groups.push({ start, count: i - start });
			start = i;
		}
	}
	return groups;
}

/** Удаляет только явно выбранную неразрывную группу; UI обязан показать её размер до подтверждения. */
export function deleteTableDocumentAxisGroup<T>(document: TableDocument<T>, axis: "row" | "column", index: number): TableDocument<T> {
	const group = getTableDocumentAxisGroups(document, axis).find((item) => index >= item.start && index < item.start + item.count);
	if (!group) throw new Error("Группа не найдена.");
	const length = axis === "row" ? document.rows.length : document.columns.length;
	if (group.count === length) throw new Error("В таблице должна остаться хотя бы одна строка и один столбец.");
	const end = group.start + group.count;
	const merges = document.merges
		.filter((merge) => merge[axis] < group.start || merge[axis] >= end)
		.map((merge) => (merge[axis] < end ? merge : { ...merge, [axis]: merge[axis] - group.count }));
	const result: TableDocument<T> =
		axis === "row"
			? {
					...document,
					merges,
					rows: document.rows.filter((_, r) => r < group.start || r >= end),
					headerRowCount: document.headerRowCount - (group.start < document.headerRowCount ? group.count : 0)
				}
			: {
					...document,
					merges,
					columns: document.columns.filter((_, c) => c < group.start || c >= end),
					rows: document.rows.map((row) => ({ ...row, cells: row.cells.filter((_, c) => c < group.start || c >= end) }))
				};
	assertTableDocument(result);
	return result;
}

/** Меняет местами соседние неразрывные группы, сохраняя порядок внутри объединений. */
export function moveTableDocumentAxisGroup<T>(
	document: TableDocument<T>,
	axis: "row" | "column",
	index: number,
	direction: -1 | 1
): TableDocument<T> {
	const groups = getTableDocumentAxisGroups(document, axis);
	const current = groups.findIndex((item) => index >= item.start && index < item.start + item.count);
	if (current < 0) throw new Error("Группа не найдена.");
	const neighbor = current + direction;
	if (neighbor < 0 || neighbor >= groups.length) return document;
	if (axis === "row" && groups[current].start < document.headerRowCount !== groups[neighbor].start < document.headerRowCount)
		return document;
	const ordered = moveArrayItemByIndex(groups, current, direction === -1 ? "up" : "down");
	const indices = ordered.flatMap((group) => Array.from({ length: group.count }, (_, offset) => group.start + offset));
	const inverse = new Map(indices.map((oldIndex, newIndex) => [oldIndex, newIndex]));
	const merges = document.merges.map((merge) => ({ ...merge, [axis]: inverse.get(merge[axis]) ?? merge[axis] }));
	const result =
		axis === "row"
			? { ...document, merges, rows: indices.map((i) => document.rows[i]) }
			: {
					...document,
					merges,
					columns: indices.map((i) => document.columns[i]),
					rows: document.rows.map((row) => ({ ...row, cells: indices.map((i) => row.cells[i]) }))
				};
	assertTableDocument(result);
	return result;
}
