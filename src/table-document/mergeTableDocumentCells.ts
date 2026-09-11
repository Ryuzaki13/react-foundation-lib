import { type TableDocument, type TableDocumentPosition } from "./tableDocument";
import {
	assertTableDocument,
	expandTableDocumentRange,
	getTableDocumentCellRange,
	tableDocumentRangesIntersect
} from "./tableDocumentGeometry";

/** Объединяет геометрию; исходные значения и identities всех ячеек остаются неизменными. */
export function mergeTableDocumentCells<T>(
	document: TableDocument<T>,
	start: TableDocumentPosition,
	end: TableDocumentPosition
): TableDocument<T> {
	assertTableDocument(document);
	const range = expandTableDocumentRange(document, start, end);
	if (range.rowSpan * range.columnSpan === 1) return document;
	const intersected = document.merges.filter((merge) => tableDocumentRangesIntersect(merge, range));
	if (
		intersected.length === 1 &&
		range.row === intersected[0].row &&
		range.column === intersected[0].column &&
		range.rowSpan === intersected[0].rowSpan &&
		range.columnSpan === intersected[0].columnSpan
	)
		return document;
	const result = { ...document, merges: [...document.merges.filter((merge) => !tableDocumentRangesIntersect(merge, range)), range] };
	assertTableDocument(result);
	return result;
}

/** Разъединяет область целиком; скрытые значения становятся видны без восстановления из копий. */
export function splitTableDocumentCell<T>(document: TableDocument<T>, position: TableDocumentPosition): TableDocument<T> {
	assertTableDocument(document);
	const range = getTableDocumentCellRange(document, position);
	if (range.rowSpan * range.columnSpan === 1) return document;
	return { ...document, merges: document.merges.filter((merge) => merge !== range) };
}
