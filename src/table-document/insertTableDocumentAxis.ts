import { type TableDocument, type TableDocumentCell } from "./tableDocument";
import { assertTableDocument } from "./tableDocumentGeometry";

/**
 * Вставка внутрь объединения увеличивает его span; вставка перед anchor сдвигает
 * область. ID и значения создаются вызывающим кодом до изменения React state.
 */
export function insertTableDocumentAxis<T>(
	document: TableDocument<T>,
	axis: "row" | "column",
	index: number,
	id: string,
	cells: readonly TableDocumentCell<T>[],
	section: "header" | "body" = "body"
): TableDocument<T> {
	assertTableDocument(document);
	const count = axis === "row" ? document.rows.length : document.columns.length;
	if (!Number.isInteger(index) || index < 0 || index > count) throw new Error("Некорректная позиция вставки.");
	if (cells.length !== (axis === "row" ? document.columns.length : document.rows.length)) throw new Error("Неверное число новых ячеек.");
	if (axis === "row" && (section === "header" ? index > document.headerRowCount : index < document.headerRowCount))
		throw new Error("Строка вставляется вне выбранной части таблицы.");
	const spanKey = axis === "row" ? "rowSpan" : "columnSpan";
	const merges = document.merges.map((merge) =>
		index <= merge[axis]
			? { ...merge, [axis]: merge[axis] + 1 }
			: index < merge[axis] + merge[spanKey]
				? { ...merge, [spanKey]: merge[spanKey] + 1 }
				: merge
	);
	const result: TableDocument<T> =
		axis === "row"
			? {
					...document,
					merges,
					headerRowCount: document.headerRowCount + (section === "header" ? 1 : 0),
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
