import { TABLE_DOCUMENT_MAX_CELLS, type TableDocument, type TableDocumentPosition, type TableDocumentRange } from "./tableDocument";

/** Проверяет пересечение двух включительных прямоугольников полной сетки. */
export function tableDocumentRangesIntersect(a: TableDocumentRange, b: TableDocumentRange): boolean {
	return (
		a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan && a.column < b.column + b.columnSpan && b.column < a.column + a.columnSpan
	);
}

/** Fail-closed инварианты для команд и внешней runtime-schema приложения. */
export function assertTableDocument<T>(document: TableDocument<T>): void {
	const height = document.rows.length;
	const width = document.columns.length;
	if (document.version !== 1 || !height || !width || height * width > TABLE_DOCUMENT_MAX_CELLS)
		throw new Error("Недопустимый размер таблицы.");
	if (!Number.isInteger(document.headerRowCount) || document.headerRowCount < 0 || document.headerRowCount > height)
		throw new Error("Некорректное число строк заголовка.");
	const identities = new Set<string>();
	const checkId = (id: string) => {
		if (!id || identities.has(id)) throw new Error("Идентификаторы строк, столбцов и ячеек должны быть уникальными.");
		identities.add(id);
	};
	for (const column of document.columns) {
		checkId(column.id);
		if (column.width !== null && (!Number.isFinite(column.width) || column.width <= 0)) throw new Error("Некорректная ширина столбца.");
	}
	for (const row of document.rows) {
		checkId(row.id);
		if (row.cells.length !== width) throw new Error("Все строки должны иметь одинаковое число ячеек.");
		row.cells.forEach((cell) => checkId(cell.id));
	}
	const occupied = new Set<number>();
	for (const merge of document.merges) {
		assertTableDocumentRange(document, merge);
		if (merge.rowSpan * merge.columnSpan === 1) throw new Error("Объединение должно содержать несколько ячеек.");
		if (merge.row < document.headerRowCount && merge.row + merge.rowSpan > document.headerRowCount)
			throw new Error("Нельзя объединять заголовок с основной частью таблицы.");
		for (let r = merge.row; r < merge.row + merge.rowSpan; r++) {
			for (let c = merge.column; c < merge.column + merge.columnSpan; c++) {
				const key = r * width + c;
				if (occupied.has(key)) throw new Error("Объединённые области пересекаются.");
				occupied.add(key);
			}
		}
	}
}

/** Проверяет границы до выполнения команды, не исправляя ошибочный ввод молча. */
export function assertTableDocumentRange<T>(document: TableDocument<T>, range: TableDocumentRange): void {
	if (
		![range.row, range.column, range.rowSpan, range.columnSpan].every(Number.isInteger) ||
		range.row < 0 ||
		range.column < 0 ||
		range.rowSpan < 1 ||
		range.columnSpan < 1 ||
		range.row + range.rowSpan > document.rows.length ||
		range.column + range.columnSpan > document.columns.length
	)
		throw new Error("Выделение выходит за границы таблицы.");
}

/** Возвращает видимый anchor для любой позиции, включая покрытую объединением. */
export function getTableDocumentCellRange<T>(document: TableDocument<T>, position: TableDocumentPosition): TableDocumentRange {
	const point = { ...position, rowSpan: 1, columnSpan: 1 };
	assertTableDocumentRange(document, point);
	return document.merges.find((merge) => tableDocumentRangesIntersect(merge, point)) ?? point;
}

/**
 * Замыкает выделение до неподвижной точки. Повторный обход обязателен: новая
 * строка прямоугольника может пересечь ещё одно объединение вне исходной области.
 */
export function expandTableDocumentRange<T>(
	document: TableDocument<T>,
	start: TableDocumentPosition,
	end: TableDocumentPosition
): TableDocumentRange {
	let range = {
		row: Math.min(start.row, end.row),
		column: Math.min(start.column, end.column),
		rowSpan: Math.abs(start.row - end.row) + 1,
		columnSpan: Math.abs(start.column - end.column) + 1
	};
	assertTableDocumentRange(document, range);
	let changed = true;
	while (changed) {
		changed = false;
		for (const merge of document.merges) {
			if (!tableDocumentRangesIntersect(range, merge)) continue;
			const row = Math.min(range.row, merge.row);
			const column = Math.min(range.column, merge.column);
			const rowSpan = Math.max(range.row + range.rowSpan, merge.row + merge.rowSpan) - row;
			const columnSpan = Math.max(range.column + range.columnSpan, merge.column + merge.columnSpan) - column;
			if (row !== range.row || column !== range.column || rowSpan !== range.rowSpan || columnSpan !== range.columnSpan) {
				range = { row, column, rowSpan, columnSpan };
				changed = true;
			}
		}
	}
	return range;
}
