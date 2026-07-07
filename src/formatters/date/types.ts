/**
 * Формат результата для источника даты.
 */
export type DateInputSource =
	| "date-object"
	| "timestamp"
	| "odata-ticks"
	| "odata-literal"
	| "abap-compact"
	| "abap-timestamp"
	| "abap-dotted"
	| "slash-date"
	| "iso-local"
	| "iso-zoned"
	| "iso-duration"
	| "native-date-parse";

/**
 * Результат парсинга календарной даты/времени.
 */
export interface ParsedDateTimeValue {
	kind: "date-time";
	source: DateInputSource;
	date: Date;
}

/**
 * Результат парсинга длительности ISO-8601.
 */
export interface ParsedDurationValue {
	kind: "duration";
	source: "iso-duration";
	durationMs: number;
}

/**
 * Универсальный результат парсинга входного значения даты.
 */
export type ParsedDateValue = ParsedDateTimeValue | ParsedDurationValue;

/**
 * Поддерживаемые токены шаблона форматирования.
 *
 * Примеры: `dd.MM.yyyy`, `dd.MM.yyyy HH:mm`, `HH:mm:ss`.
 */
export type DateFormatPattern = string;

/**
 * Базовые уровни детализации, совпадающие с семейством Intl dateStyle/timeStyle.
 */
export type DateFormatStyle = "short" | "medium" | "long";

/**
 * Точность отображения календарной даты.
 */
export type DateFormatPrecision = "day" | "month" | "year";

/**
 * Предустановка форматирования даты.
 */
export interface DateFormatPreset {
	name: string;
	pattern?: DateFormatPattern;
	locale: string;
	invalidFallback: string;
	intlOptions?: Intl.DateTimeFormatOptions;
	intlDateOptions?: Intl.DateTimeFormatOptions;
	intlTimeOptions?: Intl.DateTimeFormatOptions;
	intlJoiner?: string;
	durationPattern?: DateFormatPattern;
}

/**
 * Конфигурация для регистрации предустановки.
 */
export type DateFormatPresetConfig = Partial<Omit<DateFormatPreset, "name">> & Pick<DateFormatPreset, "name">;

/**
 * Дополнительные опции форматирования.
 */
export interface FormatDateOptions {
	/**
	 * Переопределение fallback для невалидного входа.
	 */
	fallback?: string;
	/**
	 * Точность отображения календарной части.
	 */
	precision?: DateFormatPrecision;
}
