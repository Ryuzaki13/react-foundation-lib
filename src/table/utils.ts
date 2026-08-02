import { TableColumnDef, TableColumnFormattingMeta, TableColumnMeta } from "./types";

/**
 * Интерактивные descendants, действие которых таблица не должна подменять
 * выбором строки или ячейки.
 *
 * `td`, `th` и `tr` намеренно исключены из tabindex-ветки: сама таблица может
 * использовать roving tabindex для selection, не превращая ячейку в nested control.
 */
const TABLE_INTERACTIVE_ELEMENT_SELECTOR = [
	"button",
	"a",
	"input",
	"select",
	"textarea",
	"label",
	"summary",
	"audio[controls]",
	"video[controls]",
	'[contenteditable]:not([contenteditable="false"])',
	"[tabindex]:not(td):not(th):not(tr)",
	'[draggable="true"]',
	'[role="button"]',
	'[role="link"]',
	'[role="checkbox"]',
	'[role="radio"]',
	'[role="switch"]',
	'[role="menu"]',
	'[role="menuitem"]',
	'[role="menuitemcheckbox"]',
	'[role="menuitemradio"]',
	'[role="listbox"]',
	'[role="option"]',
	'[role="tab"]',
	'[role="tablist"]',
	'[role="tree"]',
	'[role="treeitem"]',
	'[role="slider"]',
	'[role="spinbutton"]',
	'[role="textbox"]',
	'[role="searchbox"]',
	'[role="combobox"]'
].join(", ");

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

	const selector = extraSelector ? `${TABLE_INTERACTIVE_ELEMENT_SELECTOR}, ${extraSelector}` : TABLE_INTERACTIVE_ELEMENT_SELECTOR;

	return Boolean(target.closest(selector));
}
