import { type TableDocument, type TableDocumentCell } from "./tableDocument";
import {
	TABLE_DOCUMENT_AXIS_ROW,
	type TABLE_DOCUMENT_AXIS_COLUMN,
	TABLE_DOCUMENT_SECTION_HEADER,
	TABLE_DOCUMENT_SECTION_BODY
} from "./tableDocumentConstants";
import { assertTableDocument } from "./tableDocumentGeometry";

/**
 * Вставка внутрь объединения увеличивает его span; вставка перед anchor сдвигает
 * область. ID и значения создаются вызывающим кодом до изменения React state.
 */
export function insertTableDocumentAxis<T>(
	document: TableDocument<T>,
	axis: typeof TABLE_DOCUMENT_AXIS_ROW | typeof TABLE_DOCUMENT_AXIS_COLUMN,
	index: number,
	id: string,
	cells: readonly TableDocumentCell<T>[],
	section: typeof TABLE_DOCUMENT_SECTION_HEADER | typeof TABLE_DOCUMENT_SECTION_BODY = TABLE_DOCUMENT_SECTION_BODY
): TableDocument<T> {
	assertTableDocument(document);
	const count = axis === TABLE_DOCUMENT_AXIS_ROW ? document.rows.length : document.columns.length;
	if (!Number.isInteger(index) || index < 0 || index > count) throw new Error("Некорректная позиция вставки.");
	if (cells.length !== (axis === TABLE_DOCUMENT_AXIS_ROW ? document.columns.length : document.rows.length))
		throw new Error("Неверное число новых ячеек.");
	if (
		axis === TABLE_DOCUMENT_AXIS_ROW &&
		(section === TABLE_DOCUMENT_SECTION_HEADER ? index > document.headerRowCount : index < document.headerRowCount)
	)
		throw new Error("Строка вставляется вне выбранной части таблицы.");
	const spanKey = axis === TABLE_DOCUMENT_AXIS_ROW ? "rowSpan" : "columnSpan";
	const merges = document.merges.map((merge) =>
		index <= merge[axis]
			? { ...merge, [axis]: merge[axis] + 1 }
			: index < merge[axis] + merge[spanKey]
				? { ...merge, [spanKey]: merge[spanKey] + 1 }
				: merge
	);
	const result: TableDocument<T> =
		axis === TABLE_DOCUMENT_AXIS_ROW
			? {
					...document,
					merges,
					headerRowCount: document.headerRowCount + (section === TABLE_DOCUMENT_SECTION_HEADER ? 1 : 0),
					rows: [...document.rows.slice(0, index), { id, cells }, ...document.rows.slice(index)]
				}
			: {
					...document,
					merges,
					columns: [...document.columns.slice(0, index), { id, width: null }, ...document.columns.slice(index)],
					rows: document.rows.map((row, r) => ({
						...row,
						cells: [...row.cells.slice(0, index), cells[r], ...row.cells.slice(index)]
					}))
				};
	assertTableDocument(result);
	return result;
}
