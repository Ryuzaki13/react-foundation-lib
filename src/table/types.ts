import {
	type Cell,
	type Column,
	type ColumnDef,
	type ColumnVisibilityState,
	type Header,
	type Row,
	type RowData,
	type Table,
	type TableState
} from "@tanstack/react-table";

import { type FormattersPipelineRuntimeField } from "../formatters/pipeline";

import { type FoundationTableFeatures } from "./tanStackFeatures";

/**
 * Режим выбора строк таблицы.
 */
export type TableSelectionMode = "none" | "single" | "multi";

/**
 * Режим выбора ячеек таблицы.
 *
 * Отдельное имя сохраняет назначение настройки, хотя допустимая кардинальность
 * совпадает с режимами выбора строк.
 */
export type TableCellSelectionMode = TableSelectionMode;

/**
 * Способ активации выбора ячейки пользовательским событием.
 *
 * `primary-modifier` означает Ctrl в Windows/Linux и Command в macOS. Такой
 * контракт не привязывает consumer к конкретной платформе или клавиатуре.
 */
export type TableCellSelectionActivationMode = "direct" | "primary-modifier";

/** Устойчивые координаты выбранной ячейки без привязки к DOM или TanStack Row. */
export type TableCellCoordinates = Readonly<{
	rowId: string;
	columnId: string;
}>;

/** Сериализуемое состояние выбора ячеек. */
export type TableCellSelectionState = readonly TableCellCoordinates[];

/**
 * Минимальный event-like контракт для проверки клавиш-модификаторов.
 *
 * Структурный тип позволяет использовать один helper для React mouse/keyboard
 * events и для unit-тестов без зависимости алгоритма от DOM-классов.
 */
export type TableSelectionModifierEvent = Readonly<{
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
}>;

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

/** Экземпляр TanStack Table, собранный на едином foundation-наборе features. */
export type FoundationTableInstance<TData extends RowData> = Table<FoundationTableFeatures, TData>;

/** Строка TanStack Table, собранная на едином foundation-наборе features. */
export type FoundationTableRow<TData extends RowData> = Row<FoundationTableFeatures, TData>;

/** Колонка TanStack Table, собранная на едином foundation-наборе features. */
export type FoundationTableColumn<TData extends RowData, TValue = unknown> = Column<FoundationTableFeatures, TData, TValue>;

/** Ячейка TanStack Table, собранная на едином foundation-наборе features. */
export type FoundationTableCell<TData extends RowData, TValue = unknown> = Cell<FoundationTableFeatures, TData, TValue>;

/** Заголовок TanStack Table, собранный на едином foundation-наборе features. */
export type FoundationTableHeader<TData extends RowData, TValue = unknown> = Header<FoundationTableFeatures, TData, TValue>;

/** Полное состояние TanStack Table для единого foundation-набора features. */
export type FoundationTableState = TableState<FoundationTableFeatures>;

/** Публичное состояние видимости колонок TanStack Table v9. */
export type TableColumnVisibilityState = ColumnVisibilityState;

/**
 * Базовый тип колонки таблицы.
 */
export type TableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<FoundationTableFeatures, TData, TValue> & {
	meta?: TableColumnMeta;
};
