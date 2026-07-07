import { TableColumnDef, TableColumnFormattingMeta, TableColumnMeta } from "./types";

/**
 * Возвращает метаданные колонки таблицы.
 */
export function getTableColumnMeta<TData extends object>(column: TableColumnDef<TData>): TableColumnMeta | undefined {
	return column.meta;
}

/**
 * Возвращает форматирующий блок метаданных колонки.
 */
export function getTableColumnFormattingMeta<TData extends object>(column: TableColumnDef<TData>): TableColumnFormattingMeta | undefined {
	return column.meta?.formatting;
}

/**
 * Нормализует размер таблицы.
 *
 * Числовое значение трактуется как `em`, чтобы разметка масштабировалась вместе со шрифтом.
 */
export function resolveTableLength(length: string | number): string {
	if (typeof length === "number") {
		return `${length}em`;
	}

	return length;
}

/**
 * Определяет, пришёл ли клик из интерактивного элемента внутри таблицы.
 */
export function isTableInteractiveElement(target: EventTarget | null, extraSelector?: string): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	const baseSelector = 'button, a, input, select, textarea, [role="button"], [role="link"]';
	const selector = extraSelector ? `${baseSelector}, ${extraSelector}` : baseSelector;

	return Boolean(target.closest(selector));
}
