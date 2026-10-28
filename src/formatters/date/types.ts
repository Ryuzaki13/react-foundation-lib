import {
	type DATE_FORMAT_STYLE_SHORT,
	type DATE_FORMAT_STYLE_MEDIUM,
	type DATE_FORMAT_STYLE_LONG,
	type DATE_FORMAT_PRECISION_DAY,
	type DATE_FORMAT_PRECISION_MONTH,
	type DATE_FORMAT_PRECISION_YEAR
} from "./dateFormatConstants";
import {
	type DATE_INPUT_SOURCE_DATE_OBJECT,
	type DATE_INPUT_SOURCE_TIMESTAMP,
	type DATE_INPUT_SOURCE_ODATA_TICKS,
	type DATE_INPUT_SOURCE_ODATA_LITERAL,
	type DATE_INPUT_SOURCE_ABAP_COMPACT,
	type DATE_INPUT_SOURCE_ABAP_TIMESTAMP,
	type DATE_INPUT_SOURCE_ABAP_DOTTED,
	type DATE_INPUT_SOURCE_SLASH_DATE,
	type DATE_INPUT_SOURCE_ISO_LOCAL,
	type DATE_INPUT_SOURCE_ISO_ZONED,
	type DATE_INPUT_SOURCE_ISO_DURATION,
	type PARSED_DATE_KIND_DATE_TIME,
	type PARSED_DATE_KIND_DURATION
} from "./dateValueConstants";

/**
 * Формат результата для источника даты.
 */
export type DateInputSource =
	| typeof DATE_INPUT_SOURCE_DATE_OBJECT
	| typeof DATE_INPUT_SOURCE_TIMESTAMP
	| typeof DATE_INPUT_SOURCE_ODATA_TICKS
	| typeof DATE_INPUT_SOURCE_ODATA_LITERAL
	| typeof DATE_INPUT_SOURCE_ABAP_COMPACT
	| typeof DATE_INPUT_SOURCE_ABAP_TIMESTAMP
	| typeof DATE_INPUT_SOURCE_ABAP_DOTTED
	| typeof DATE_INPUT_SOURCE_SLASH_DATE
	| typeof DATE_INPUT_SOURCE_ISO_LOCAL
	| typeof DATE_INPUT_SOURCE_ISO_ZONED
	| typeof DATE_INPUT_SOURCE_ISO_DURATION
	| "native-date-parse";

/**
 * Результат парсинга календарной даты/времени.
 */
export interface ParsedDateTimeValue {
	kind: typeof PARSED_DATE_KIND_DATE_TIME;
	source: DateInputSource;
	date: Date;
}

/**
 * Результат парсинга длительности ISO-8601.
 */
export interface ParsedDurationValue {
	kind: typeof PARSED_DATE_KIND_DURATION;
	source: typeof DATE_INPUT_SOURCE_ISO_DURATION;
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
export type DateFormatStyle = typeof DATE_FORMAT_STYLE_SHORT | typeof DATE_FORMAT_STYLE_MEDIUM | typeof DATE_FORMAT_STYLE_LONG;

/**
 * Точность отображения календарной даты.
 */
export type DateFormatPrecision = typeof DATE_FORMAT_PRECISION_DAY | typeof DATE_FORMAT_PRECISION_MONTH | typeof DATE_FORMAT_PRECISION_YEAR;

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
