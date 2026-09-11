/** Координаты относятся к полной сетке, включая скрытые объединением ячейки. */
export type TableDocumentPosition = { readonly row: number; readonly column: number };

/** Прямоугольная область; spans всегда положительные целые числа. */
export type TableDocumentRange = TableDocumentPosition & { readonly rowSpan: number; readonly columnSpan: number };

/** Значение принадлежит приложению; ядро никогда не преобразует и не объединяет содержимое. */
export type TableDocumentCell<T> = { readonly id: string; readonly value: T };
export type TableDocumentRow<T> = { readonly id: string; readonly cells: readonly TableDocumentCell<T>[] };
export type TableDocumentColumn = { readonly id: string; readonly width: number | null };

/**
 * Документ редактора, независимый от TanStack и DOM. Полная матрица хранит все
 * значения; merges содержит только непересекающиеся видимые объединения.
 * Это исключает устаревшие spans у скрытых ячеек после повторного merge/split.
 */
export type TableDocument<T> = {
	readonly version: 1;
	readonly caption: string;
	readonly columns: readonly TableDocumentColumn[];
	readonly rows: readonly TableDocumentRow<T>[];
	readonly merges: readonly TableDocumentRange[];
	readonly headerRowCount: number;
	readonly hideHeaders: boolean;
	readonly showRowNumbers: boolean;
};

/** Лимит защищает проверки геометрии и UI от случайно огромной сетки. */
export const TABLE_DOCUMENT_MAX_CELLS = 20_000;
