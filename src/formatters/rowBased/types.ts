export type RowBasedFormatterContextInstrumentation = {
	onReadIndex?: (index: number) => void;
	onOutOfRangeIndex?: (index: number) => void;
};

/**
 * Контекст исполнения формулы подмены значения для групповой строки.
 */
export type RowBasedFormatterContext = {
	rowData: Record<string, unknown>;
	rawValue: unknown;
	columnId: string;
	key: (index: number) => string | undefined;
	value: (index: number) => unknown;
	num: (index: number) => number;
};

/**
 * Функция формулы подмены значения для групповой строки.
 */
export type RowBasedFormatterFn = (ctx: RowBasedFormatterContext) => unknown;

/**
 * Описание формулы подмены значения для групповой строки.
 */
export type RowBasedFormatterDefinition = {
	id: string;
	name: string;
	description: string;
	fn: RowBasedFormatterFn;
};
