import { type ColumnDef } from "@tanstack/react-table";

import { type FormattersPipelineRuntimeField } from "../formatters/pipeline";

/**
 * Режим выбора строк таблицы.
 */
export type TableSelectionMode = "none" | "single" | "multi";

/**
 * Выравнивание содержимого ячейки таблицы.
 */
export type TableColumnAlign = "left" | "center" | "right";

type TableColumnFormattingOptions = Omit<
	FormattersPipelineRuntimeField,
	"id" | "role" | "type" | "formulaExecutor" | "formattersPipelineExecutor"
>;

/**
 * Форматирующий input-контракт generic-колонки.
 *
 * `role/type` можно не указывать для маленьких локальных таблиц: snapshot
 * нормализует их в runtime-field перед компиляцией pipeline.
 */
export type TableColumnFormattingMeta = TableColumnFormattingOptions &
	Partial<Pick<FormattersPipelineRuntimeField, "id" | "role" | "type">>;

/**
 * Пользовательские настройки форматирования, которые можно добавить к
 * runtime-полю, построенному из metadata колонки.
 */
export type TableColumnFormattingMetaInput = TableColumnFormattingOptions;

/**
 * Метаданные колонки таблицы.
 */
export interface TableColumnMeta {
	/**
	 * Ширина колонки.
	 *
	 * Строка используется как CSS-значение, число трактуется как `em`.
	 */
	width?: number | "auto" | `${number}%`;

	/**
	 * Выравнивание содержимого заголовка и ячеек.
	 */
	align?: TableColumnAlign;

	/**
	 * Включает display-only слияние подряд идущих дубликатов без изменения структуры строк.
	 *
	 * Сравнение выполняется по raw-значению `accessor`/`cell.getValue()`, а не по
	 * отформатированному отображению. Повторяющиеся значения скрываются в
	 * последующих строках, а визуальная склейка выполняется через CSS.
	 */
	mergeDuplicates?: boolean;

	/**
	 * Декларативный конфиг форматирования ячейки.
	 *
	 * @experimental не использовать, функционал в разработке
	 */
	formatting?: TableColumnFormattingMeta;
}

/**
 * Базовый тип колонки таблицы.
 */
export type TableColumnDef<TData extends object, TValue = unknown> = ColumnDef<TData, TValue> & {
	meta?: TableColumnMeta;
};
