import { type TableDocument, type TableDocumentPosition } from "./tableDocument";
import { assertTableDocumentRange } from "./tableDocumentGeometry";

/** Меняет ровно одну логическую ячейку; преобразование rich text/документов выполняет приложение. */
export function updateTableDocumentCell<T>(document: TableDocument<T>, position: TableDocumentPosition, value: T): TableDocument<T> {
	assertTableDocumentRange(document, { ...position, rowSpan: 1, columnSpan: 1 });
	if (Object.is(document.rows[position.row].cells[position.column].value, value)) return document;
	return {
		...document,
		rows: document.rows.map((row, r) =>
			r !== position.row ? row : { ...row, cells: row.cells.map((cell, c) => (c !== position.column ? cell : { ...cell, value })) }
		)
	};
}
