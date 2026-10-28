import { MS_IN_SECOND, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "./calendarDateConstants";
import {
	DEFAULT_DATE_LOCALE,
	INTL_DATE_PART_TWO_DIGIT,
	INTL_DATE_PART_NUMERIC,
	INTL_DATE_HOUR_CYCLE_23,
	DATE_FORMAT_STYLE_SHORT,
	DATE_FORMAT_STYLE_MEDIUM,
	DATE_FORMAT_STYLE_LONG,
	DATE_FORMAT_PRECISION_DAY,
	DATE_FORMAT_PRECISION_MONTH,
	DATE_FORMAT_PRECISION_YEAR,
	INTL_DATE_MONTH_SHORT,
	INTL_DATE_MONTH_LONG,
	INTL_DATE_PART_YEAR,
	INTL_DATE_PART_MONTH
} from "./dateFormatConstants";
import {
	DATE_PATTERN_TIME_MINUTES,
	DATE_PATTERN_TIME_SECONDS,
	DATE_PATTERN_ISO_DATE,
	DATE_PATTERN_ISO_DATE_TIME,
	DATE_PATTERN_ABAP_DATE_TIME,
	DATE_PATTERN_ABAP_DATE,
	DATE_PATTERN_TOKEN_YEAR,
	DATE_PATTERN_TOKEN_SHORT_YEAR,
	DATE_PATTERN_TOKEN_MONTH,
	DATE_PATTERN_TOKEN_DAY,
	DATE_PATTERN_TOKEN_HOURS,
	DATE_PATTERN_TOKEN_MINUTES,
	DATE_PATTERN_TOKEN_SECONDS
} from "./datePatternConstants";
import {
	DATE_PRESET_NAME_DATE,
	DATE_PRESET_NAME_DATE_SHORT,
	DATE_PRESET_NAME_DATE_MEDIUM,
	DATE_PRESET_NAME_DATE_LONG,
	DATE_PRESET_NAME_MONTH_YEAR_MEDIUM,
	DATE_PRESET_NAME_MONTH_YEAR_LONG,
	DATE_PRESET_NAME_DATETIME,
	DATE_PRESET_NAME_DATETIME_SECONDS,
	DATE_PRESET_NAME_TIME,
	DATE_PRESET_NAME_TIME_SECONDS,
	DATE_PRESET_NAME_ODATA_DATE,
	DATE_PRESET_NAME_ODATA_DATETIME,
	DATE_PRESET_NAME_ABAP_DATETIME,
	DATE_PRESET_NAME_ABAP_DATE,
	DATE_PRESET_NAME_ABAP_MONTH,
	DATE_PRESET_NAME_ABAP_YEAR,
	DATE_PRESET_NAME_MONTH_SHORT,
	DATE_PRESET_NAME_MONTH_MEDIUM,
	DATE_PRESET_NAME_MONTH_LONG,
	DATE_PRESET_NAME_DATETIME_SHORT,
	DATE_PRESET_NAME_DATETIME_MEDIUM,
	DATE_PRESET_NAME_DATETIME_LONG,
	DATE_PRESET_NAME_TIME_SHORT,
	DATE_PRESET_NAME_TIME_MEDIUM,
	DATE_PRESET_NAME_TIME_LONG
} from "./datePresetNameConstants";
import {
	containsDatePatternToken,
	DATE_PATTERN_DATE_TOKENS,
	DATE_PATTERN_TIME_TOKENS,
	DATE_PATTERN_TOKEN_RE,
	isDatePatternToken,
	resolveDatePatternPrecision
} from "./pattern";

import type { DateFormatPrecision, DateFormatPreset, DateFormatPresetConfig, DateFormatStyle } from "./types";

/**
 * Функция, которая форматирует уже подготовленную календарную дату.
 */
export type CompiledDateFormatter = (date: Date, precision?: DateFormatPrecision) => string;

/**
 * Внутреннее представление предустановки с заранее созданными форматтерами.
 */
export interface CompiledDateFormatPreset extends DateFormatPreset {
	formatDateTime: CompiledDateFormatter;
	formatDuration?: (durationMs: number, fallback: string) => string;
}

/**
 * Уровни детализации, для которых создаются встроенные style-пресеты.
 */
const FORMAT_STYLES = Object.freeze([DATE_FORMAT_STYLE_SHORT, DATE_FORMAT_STYLE_MEDIUM, DATE_FORMAT_STYLE_LONG] as const);
const FORMAT_PRECISIONS = Object.freeze([DATE_FORMAT_PRECISION_DAY, DATE_FORMAT_PRECISION_MONTH, DATE_FORMAT_PRECISION_YEAR] as const);

/**
 * Значения по умолчанию для предустановок форматирования дат.
 */
export const DATE_FORMAT_DEFAULTS: Omit<DateFormatPreset, "name" | "intlOptions"> & { intlOptions: Intl.DateTimeFormatOptions } = {
	locale: DEFAULT_DATE_LOCALE,
	intlOptions: { day: INTL_DATE_PART_TWO_DIGIT, month: INTL_DATE_PART_TWO_DIGIT, year: INTL_DATE_PART_NUMERIC },
	invalidFallback: ""
};

/**
 * Имена встроенных предустановок.
 */
export const DEFAULT_DATE_PRESET_NAMES = Object.freeze({
	date: DATE_PRESET_NAME_DATE,
	dateShort: DATE_PRESET_NAME_DATE_SHORT,
	dateMedium: DATE_PRESET_NAME_DATE_MEDIUM,
	dateLong: DATE_PRESET_NAME_DATE_LONG,
	monthShort: DATE_PRESET_NAME_MONTH_SHORT,
	monthMedium: DATE_PRESET_NAME_MONTH_MEDIUM,
	monthLong: DATE_PRESET_NAME_MONTH_LONG,
	monthYearMedium: DATE_PRESET_NAME_MONTH_YEAR_MEDIUM,
	monthYearLong: DATE_PRESET_NAME_MONTH_YEAR_LONG,
	datetime: DATE_PRESET_NAME_DATETIME,
	datetimeSeconds: DATE_PRESET_NAME_DATETIME_SECONDS,
	datetimeShort: DATE_PRESET_NAME_DATETIME_SHORT,
	datetimeMedium: DATE_PRESET_NAME_DATETIME_MEDIUM,
	datetimeLong: DATE_PRESET_NAME_DATETIME_LONG,
	time: DATE_PRESET_NAME_TIME,
	timeSeconds: DATE_PRESET_NAME_TIME_SECONDS,
	timeShort: DATE_PRESET_NAME_TIME_SHORT,
	timeMedium: DATE_PRESET_NAME_TIME_MEDIUM,
	timeLong: DATE_PRESET_NAME_TIME_LONG,
	odataDate: DATE_PRESET_NAME_ODATA_DATE,
	odataDatetime: DATE_PRESET_NAME_ODATA_DATETIME,
	abapDatetime: DATE_PRESET_NAME_ABAP_DATETIME,
	abapDate: DATE_PRESET_NAME_ABAP_DATE,
	abapMonth: DATE_PRESET_NAME_ABAP_MONTH,
	abapYear: DATE_PRESET_NAME_ABAP_YEAR
});

/**
 * Алиасы style-форматов даты к именам встроенных date-пресетов.
 */
export const DATE_FORMAT_STYLE_PRESET_NAMES: Readonly<Record<DateFormatStyle, string>> = Object.freeze({
	short: DATE_PRESET_NAME_DATE_SHORT,
	medium: DATE_PRESET_NAME_DATE_MEDIUM,
	long: DATE_PRESET_NAME_DATE_LONG
});

const patternPresetCache = new Map<string, DateFormatPreset>();

/**
 * Встроенные предустановки форматирования дат.
 */
const BUILTIN_PRESETS: DateFormatPresetConfig[] = [
	{
		name: DATE_PRESET_NAME_DATE,
		intlOptions: { day: INTL_DATE_PART_TWO_DIGIT, month: INTL_DATE_PART_TWO_DIGIT, year: INTL_DATE_PART_NUMERIC }
	},
	{
		name: DATE_PRESET_NAME_DATETIME,
		intlDateOptions: { day: INTL_DATE_PART_TWO_DIGIT, month: INTL_DATE_PART_TWO_DIGIT, year: INTL_DATE_PART_NUMERIC },
		intlTimeOptions: { hour: INTL_DATE_PART_TWO_DIGIT, minute: INTL_DATE_PART_TWO_DIGIT, hourCycle: INTL_DATE_HOUR_CYCLE_23 },
		intlJoiner: " "
	},
	{
		name: DATE_PRESET_NAME_DATETIME_SECONDS,
		intlDateOptions: { day: INTL_DATE_PART_TWO_DIGIT, month: INTL_DATE_PART_TWO_DIGIT, year: INTL_DATE_PART_NUMERIC },
		intlTimeOptions: {
			hour: INTL_DATE_PART_TWO_DIGIT,
			minute: INTL_DATE_PART_TWO_DIGIT,
			second: INTL_DATE_PART_TWO_DIGIT,
			hourCycle: INTL_DATE_HOUR_CYCLE_23
		},
		intlJoiner: " "
	},
	{
		name: DATE_PRESET_NAME_TIME,
		intlOptions: { hour: INTL_DATE_PART_TWO_DIGIT, minute: INTL_DATE_PART_TWO_DIGIT, hourCycle: INTL_DATE_HOUR_CYCLE_23 },
		durationPattern: DATE_PATTERN_TIME_MINUTES
	},
	{
		name: DATE_PRESET_NAME_TIME_SECONDS,
		intlOptions: {
			hour: INTL_DATE_PART_TWO_DIGIT,
			minute: INTL_DATE_PART_TWO_DIGIT,
			second: INTL_DATE_PART_TWO_DIGIT,
			hourCycle: INTL_DATE_HOUR_CYCLE_23
		},
		durationPattern: DATE_PATTERN_TIME_SECONDS
	},
	...FORMAT_STYLES.map((style) => ({
		name: `date-${style}`,
		intlOptions: getDateStyleIntlOptions(style)
	})),
	...FORMAT_STYLES.map((style) => ({
		name: `month-${style}`,
		intlOptions: getMonthStyleIntlOptions(style)
	})),
	{
		name: DATE_PRESET_NAME_MONTH_YEAR_MEDIUM,
		intlOptions: { month: INTL_DATE_MONTH_SHORT, year: INTL_DATE_PART_NUMERIC }
	},
	{
		name: DATE_PRESET_NAME_MONTH_YEAR_LONG,
		intlOptions: { month: INTL_DATE_MONTH_LONG, year: INTL_DATE_PART_NUMERIC }
	},
	...FORMAT_STYLES.map((style) => ({
		name: `time-${style}`,
		intlOptions: getTimeStyleIntlOptions(style),
		durationPattern: style === DATE_FORMAT_STYLE_SHORT ? DATE_PATTERN_TIME_MINUTES : DATE_PATTERN_TIME_SECONDS
	})),
	...FORMAT_STYLES.map((style) => ({
		name: `datetime-${style}`,
		intlDateOptions: getDateStyleIntlOptions(style),
		intlTimeOptions: getTimeStyleIntlOptions(style),
		intlJoiner: ", "
	})),
	{ name: DATE_PRESET_NAME_ODATA_DATE, pattern: DATE_PATTERN_ISO_DATE },
	{ name: DATE_PRESET_NAME_ODATA_DATETIME, pattern: DATE_PATTERN_ISO_DATE_TIME },
	{ name: DATE_PRESET_NAME_ABAP_DATETIME, pattern: DATE_PATTERN_ABAP_DATE_TIME },
	{ name: DATE_PRESET_NAME_ABAP_DATE, pattern: DATE_PATTERN_ABAP_DATE },
	{ name: DATE_PRESET_NAME_ABAP_MONTH, pattern: "yyyyMM" },
	{ name: DATE_PRESET_NAME_ABAP_YEAR, pattern: DATE_PATTERN_TOKEN_YEAR }
];

/**
 * Текстовая детализация месяца для встроенных пресетов `месяц + год`.
 */
const MONTH_YEAR_PRESET_STYLES: ReadonlyMap<string, typeof INTL_DATE_MONTH_SHORT | typeof INTL_DATE_MONTH_LONG> = new Map([
	[DATE_PRESET_NAME_MONTH_YEAR_MEDIUM, INTL_DATE_MONTH_SHORT],
	[DATE_PRESET_NAME_MONTH_YEAR_LONG, INTL_DATE_MONTH_LONG]
]);

/**
 * Реестр предустановок форматирования.
 */
const registry = new Map<string, CompiledDateFormatPreset>();

/**
 * Дополняет числовую часть даты ведущим нулём.
 */
function padDatePart(value: number, size = 2): string {
	return String(value).padStart(size, "0");
}

/**
 * Возвращает настройки Intl для dateStyle-подобного формата без timezone-семантики.
 */
function getDateStyleIntlOptions(
	style: DateFormatStyle,
	precision: DateFormatPrecision = DATE_FORMAT_PRECISION_DAY
): Intl.DateTimeFormatOptions {
	if (precision === DATE_FORMAT_PRECISION_YEAR) return { year: INTL_DATE_PART_NUMERIC };

	if (precision === DATE_FORMAT_PRECISION_MONTH) {
		if (style === DATE_FORMAT_STYLE_SHORT) return { month: INTL_DATE_PART_TWO_DIGIT, year: INTL_DATE_PART_NUMERIC };
		if (style === DATE_FORMAT_STYLE_MEDIUM) return { month: INTL_DATE_MONTH_SHORT, year: INTL_DATE_PART_NUMERIC };
		return { month: INTL_DATE_MONTH_LONG, year: INTL_DATE_PART_NUMERIC };
	}

	if (style === DATE_FORMAT_STYLE_SHORT)
		return { day: INTL_DATE_PART_TWO_DIGIT, month: INTL_DATE_PART_TWO_DIGIT, year: INTL_DATE_PART_NUMERIC };
	if (style === DATE_FORMAT_STYLE_MEDIUM)
		return { day: INTL_DATE_PART_NUMERIC, month: INTL_DATE_MONTH_SHORT, year: INTL_DATE_PART_NUMERIC };
	return { day: INTL_DATE_PART_NUMERIC, month: INTL_DATE_MONTH_LONG, year: INTL_DATE_PART_NUMERIC };
}

/**
 * Возвращает настройки Intl для dateStyle-подобного формата без года.
 *
 * Семейство сохраняет различия стандартных уровней детализации:
 * числовой short, сокращённый текстовый medium и полный текстовый long.
 */
function getMonthStyleIntlOptions(style: DateFormatStyle): Intl.DateTimeFormatOptions {
	if (style === DATE_FORMAT_STYLE_SHORT) return { day: INTL_DATE_PART_TWO_DIGIT, month: INTL_DATE_PART_TWO_DIGIT };
	if (style === DATE_FORMAT_STYLE_MEDIUM) return { day: INTL_DATE_PART_NUMERIC, month: INTL_DATE_MONTH_SHORT };
	return { day: INTL_DATE_PART_NUMERIC, month: INTL_DATE_MONTH_LONG };
}

/**
 * Возвращает настройки Intl для timeStyle-подобного формата без timezoneName.
 *
 * Intl timeStyle="long" добавляет часовой пояс в результат. В этом модуле
 * timezone намеренно не существует, поэтому long повторяет секундную точность
 * без вывода GMT/UTC-метки.
 */
function getTimeStyleIntlOptions(style: DateFormatStyle): Intl.DateTimeFormatOptions {
	if (style === DATE_FORMAT_STYLE_SHORT)
		return { hour: INTL_DATE_PART_TWO_DIGIT, minute: INTL_DATE_PART_TWO_DIGIT, hourCycle: INTL_DATE_HOUR_CYCLE_23 };
	return {
		hour: INTL_DATE_PART_TWO_DIGIT,
		minute: INTL_DATE_PART_TWO_DIGIT,
		second: INTL_DATE_PART_TWO_DIGIT,
		hourCycle: INTL_DATE_HOUR_CYCLE_23
	};
}

/**
 * Удаляет timezone из настроек Intl, чтобы форматирование не могло сдвинуть
 * календарные компоненты или вывести timezoneName в строку.
 */
function sanitizeIntlOptions(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
	const { timeZone, timeZoneName, ...safeOptions } = options;
	void timeZone;
	void timeZoneName;
	return safeOptions;
}

/**
 * Проверяет, содержит ли Intl-конфигурация календарные поля.
 */
function hasIntlDateFields(options: Intl.DateTimeFormatOptions): boolean {
	return Boolean(options.dateStyle || options.year || options.month || options.day);
}

/**
 * Приводит Intl-конфигурацию к выбранной точности календарной даты.
 */
function resolveIntlDatePrecisionOptions(options: Intl.DateTimeFormatOptions, precision: DateFormatPrecision): Intl.DateTimeFormatOptions {
	const safeOptions = sanitizeIntlOptions(options);
	if (precision === DATE_FORMAT_PRECISION_DAY || !hasIntlDateFields(safeOptions)) return safeOptions;

	if (safeOptions.dateStyle) {
		const style =
			safeOptions.dateStyle === DATE_FORMAT_STYLE_SHORT || safeOptions.dateStyle === DATE_FORMAT_STYLE_MEDIUM
				? safeOptions.dateStyle
				: DATE_FORMAT_STYLE_LONG;
		return getDateStyleIntlOptions(style, precision);
	}

	if (precision === DATE_FORMAT_PRECISION_YEAR) {
		return { year: safeOptions.year ?? INTL_DATE_PART_NUMERIC };
	}

	return {
		month: safeOptions.month ?? INTL_DATE_PART_TWO_DIGIT,
		year: safeOptions.year ?? INTL_DATE_PART_NUMERIC
	};
}

/**
 * Создаёт функцию Intl-форматирования без timezone-настроек.
 *
 * Стандартный Intl timeStyle="long" и timeStyle="full" выводят timezoneName.
 * Поэтому любые timeStyle-настройки нормализуются в явные поля времени.
 */
function createIntlFormatter(locale: string, options: Intl.DateTimeFormatOptions): CompiledDateFormatter {
	const safeOptions = sanitizeIntlOptions(options);
	const precisionFormatters = new Map<DateFormatPrecision, Intl.DateTimeFormat>();

	if (safeOptions.timeStyle) {
		const timeOptions = getTimeStyleIntlOptions(
			safeOptions.timeStyle === DATE_FORMAT_STYLE_SHORT ? DATE_FORMAT_STYLE_SHORT : DATE_FORMAT_STYLE_MEDIUM
		);

		if (safeOptions.dateStyle) {
			const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: safeOptions.dateStyle });
			const timeFormatter = new Intl.DateTimeFormat(locale, timeOptions);
			return (date, precision = DATE_FORMAT_PRECISION_DAY) => {
				if (precision === DATE_FORMAT_PRECISION_DAY) return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;

				const precisionOptions = resolveIntlDatePrecisionOptions({ dateStyle: safeOptions.dateStyle }, precision);
				let precisionFormatter = precisionFormatters.get(precision);
				if (!precisionFormatter) {
					precisionFormatter = new Intl.DateTimeFormat(locale, precisionOptions);
					precisionFormatters.set(precision, precisionFormatter);
				}

				return precisionFormatter.format(date);
			};
		}

		return new Intl.DateTimeFormat(locale, timeOptions).format;
	}

	const defaultFormatter = new Intl.DateTimeFormat(locale, safeOptions);
	return (date, precision = DATE_FORMAT_PRECISION_DAY) => {
		if (precision === DATE_FORMAT_PRECISION_DAY) return defaultFormatter.format(date);

		let precisionFormatter = precisionFormatters.get(precision);
		if (!precisionFormatter) {
			precisionFormatter = new Intl.DateTimeFormat(locale, resolveIntlDatePrecisionOptions(safeOptions, precision));
			precisionFormatters.set(precision, precisionFormatter);
		}

		return precisionFormatter.format(date);
	};
}

/**
 * Возвращает значение токена шаблона для календарной даты.
 */
function getPatternTokenValue(token: string, date: Date): string {
	const fullYear = String(date.getFullYear());

	switch (token) {
		case DATE_PATTERN_TOKEN_YEAR:
			return fullYear;
		case DATE_PATTERN_TOKEN_SHORT_YEAR:
			return fullYear.slice(-2);
		case DATE_PATTERN_TOKEN_MONTH:
			return padDatePart(date.getMonth() + 1);
		case DATE_PATTERN_TOKEN_DAY:
			return padDatePart(date.getDate());
		case DATE_PATTERN_TOKEN_HOURS:
			return padDatePart(date.getHours());
		case DATE_PATTERN_TOKEN_MINUTES:
			return padDatePart(date.getMinutes());
		case DATE_PATTERN_TOKEN_SECONDS:
			return padDatePart(date.getSeconds());
		default:
			return token;
	}
}

/**
 * Компилирует машинный шаблон в функцию без разбора шаблона на каждый вызов.
 */
function compileFixedPatternFormatter(pattern: string): CompiledDateFormatter {
	switch (pattern) {
		case DATE_PATTERN_ABAP_DATE:
			return (date) => `${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}`;
		case DATE_PATTERN_ABAP_DATE_TIME:
			return (date) =>
				`${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}${padDatePart(date.getHours())}${padDatePart(
					date.getMinutes()
				)}${padDatePart(date.getSeconds())}`;
		case DATE_PATTERN_ISO_DATE:
			return (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
		case DATE_PATTERN_ISO_DATE_TIME:
			return (date) =>
				`${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(
					date.getMinutes()
				)}:${padDatePart(date.getSeconds())}`;
		default:
			return compileGenericPatternFormatter(pattern);
	}
}

/**
 * Компилирует машинный шаблон с учётом точности календарной даты.
 */
function compilePatternFormatter(pattern: string): CompiledDateFormatter {
	const precisionFormatters = new Map<DateFormatPrecision, CompiledDateFormatter>();

	return (date, precision = DATE_FORMAT_PRECISION_DAY) => {
		let formatter = precisionFormatters.get(precision);
		if (!formatter) {
			formatter = compileFixedPatternFormatter(resolveDatePatternPrecision(pattern, precision));
			precisionFormatters.set(precision, formatter);
		}

		return formatter(date, DATE_FORMAT_PRECISION_DAY);
	};
}

/**
 * Компилирует произвольный шаблон один раз при регистрации предустановки.
 */
function compileGenericPatternFormatter(pattern: string): CompiledDateFormatter {
	const segments: string[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	DATE_PATTERN_TOKEN_RE.lastIndex = 0;
	while ((match = DATE_PATTERN_TOKEN_RE.exec(pattern))) {
		if (match.index > lastIndex) segments.push(pattern.slice(lastIndex, match.index));
		segments.push(match[0]);
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < pattern.length) segments.push(pattern.slice(lastIndex));

	return (date) => {
		let result = "";
		for (const segment of segments) {
			result += isDatePatternToken(segment) ? getPatternTokenValue(segment, date) : segment;
		}
		return result;
	};
}

/**
 * Форматирует длительность в предскомпилированный time-шаблон.
 */
function formatDurationByPattern(durationMs: number, pattern: string, fallback: string): string {
	if (containsDatePatternToken(pattern, DATE_PATTERN_DATE_TOKENS)) return fallback;
	if (!containsDatePatternToken(pattern, DATE_PATTERN_TIME_TOKENS)) return fallback;

	const sign = durationMs < 0 ? "-" : "";
	const absoluteSeconds = Math.trunc(Math.abs(durationMs) / MS_IN_SECOND);
	const hours = Math.trunc(absoluteSeconds / SECONDS_PER_HOUR);
	const minutes = Math.trunc((absoluteSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const seconds = absoluteSeconds % SECONDS_PER_MINUTE;

	if (pattern === DATE_PATTERN_TIME_MINUTES) return `${sign}${padDatePart(hours)}:${padDatePart(minutes)}`;
	if (pattern === DATE_PATTERN_TIME_SECONDS) return `${sign}${padDatePart(hours)}:${padDatePart(minutes)}:${padDatePart(seconds)}`;

	return (
		sign +
		pattern
			.replaceAll(DATE_PATTERN_TOKEN_HOURS, padDatePart(hours))
			.replaceAll(DATE_PATTERN_TOKEN_MINUTES, padDatePart(minutes))
			.replaceAll(DATE_PATTERN_TOKEN_SECONDS, padDatePart(seconds))
	);
}

/**
 * Компилирует Intl-форматтер или машинный шаблон для предустановки.
 */
export function compileDatePreset(config: DateFormatPresetConfig | DateFormatPreset): CompiledDateFormatPreset {
	const preset: DateFormatPreset = { ...DATE_FORMAT_DEFAULTS, ...config };
	const formatDateTime = createPresetFormatter(preset);
	const durationPattern = preset.durationPattern ?? preset.pattern;
	const compiledPreset: CompiledDateFormatPreset = { ...preset, formatDateTime };

	if (durationPattern) {
		compiledPreset.formatDuration = (durationMs, fallback) => formatDurationByPattern(durationMs, durationPattern, fallback);
	}

	return compiledPreset;
}

/**
 * Создаёт функцию форматирования даты для предустановки.
 */
function createPresetFormatter(preset: DateFormatPreset): CompiledDateFormatter {
	if (preset.pattern) return compilePatternFormatter(preset.pattern);

	if (preset.intlDateOptions && preset.intlTimeOptions) {
		const dateFormatter = createIntlFormatter(preset.locale, preset.intlDateOptions);
		const timeFormatter = createIntlFormatter(preset.locale, preset.intlTimeOptions);
		const joiner = preset.intlJoiner ?? " ";

		return (date, precision = DATE_FORMAT_PRECISION_DAY) => {
			if (precision !== DATE_FORMAT_PRECISION_DAY) return dateFormatter(date, precision);
			return `${dateFormatter(date)}${joiner}${timeFormatter(date)}`;
		};
	}

	return createIntlFormatter(preset.locale, preset.intlOptions ?? DATE_FORMAT_DEFAULTS.intlOptions);
}

/**
 * Создаёт форматтер месяца и года без локализованного маркера года `г.`.
 *
 * `Intl.DateTimeFormat` для `ru-RU` добавляет этот маркер автоматически.
 * Пресет предназначен для компактного отображения месячной точности в DateInput,
 * поэтому собирает только содержательные части `month` и `year`.
 */
function createMonthYearFormatter(
	locale: string,
	monthStyle: typeof INTL_DATE_MONTH_SHORT | typeof INTL_DATE_MONTH_LONG
): CompiledDateFormatter {
	// Русская локаль сокращает название месяца только в контексте даты с днём.
	// День нужен Intl для правильной формы, но в итоговую строку не включается.
	const monthYearFormatter = new Intl.DateTimeFormat(
		locale,
		monthStyle === INTL_DATE_MONTH_SHORT
			? { day: INTL_DATE_PART_NUMERIC, month: monthStyle, year: INTL_DATE_PART_NUMERIC }
			: { month: monthStyle, year: INTL_DATE_PART_NUMERIC }
	);
	const standaloneMonthFormatter = new Intl.DateTimeFormat(locale, { month: INTL_DATE_MONTH_LONG });
	const yearFormatter = new Intl.DateTimeFormat(locale, { year: INTL_DATE_PART_NUMERIC });

	return (date, precision = DATE_FORMAT_PRECISION_DAY) => {
		const formatter = precision === DATE_FORMAT_PRECISION_YEAR ? yearFormatter : monthYearFormatter;
		const parts = formatter.formatToParts(date);
		const year = parts.find((part) => part.type === INTL_DATE_PART_YEAR)?.value ?? "";
		if (precision === DATE_FORMAT_PRECISION_YEAR) return year;

		const contextualMonth = parts.find((part) => part.type === INTL_DATE_PART_MONTH)?.value ?? "";
		// Для мая Intl возвращает нескорочённую родительную форму `мая`.
		// Если сокращение с точкой отсутствует, берём самостоятельную форму `май`.
		const month =
			monthStyle === INTL_DATE_MONTH_SHORT && !contextualMonth.endsWith(".")
				? (standaloneMonthFormatter.formatToParts(date).find((part) => part.type === INTL_DATE_PART_MONTH)?.value ??
					contextualMonth)
				: contextualMonth;

		return `${month} ${year}`;
	};
}

/**
 * Компилирует встроенный пресет с учётом его фиксированной семантики.
 */
function compileBuiltinDatePreset(config: DateFormatPresetConfig): CompiledDateFormatPreset {
	const preset = compileDatePreset(config);
	const monthYearStyle = MONTH_YEAR_PRESET_STYLES.get(config.name);
	if (!monthYearStyle) return preset;

	return {
		...preset,
		formatDateTime: createMonthYearFormatter(preset.locale, monthYearStyle)
	};
}

/**
 * Инициализирует реестр встроенными предустановками.
 */
function initPresets(): void {
	for (const config of BUILTIN_PRESETS) {
		registry.set(config.name, compileBuiltinDatePreset(config));
	}
}

initPresets();

/**
 * Возвращает предустановку по имени.
 */
export function getDatePreset(name: string): DateFormatPreset | undefined {
	return registry.get(name);
}

/**
 * Возвращает скомпилированную предустановку по имени.
 */
export function getCompiledDatePreset(name: string): CompiledDateFormatPreset | undefined {
	return registry.get(name);
}

/**
 * Возвращает список имён доступных предустановок.
 */
export function getDatePresetNames(): string[] {
	return Array.from(registry.keys());
}

/**
 * Проверяет, что строка является алиасом style-пресета даты.
 */
export function isDateFormatStyle(value: string): value is DateFormatStyle {
	return FORMAT_STYLES.includes(value as DateFormatStyle);
}

/**
 * Проверяет, что строка является поддерживаемой точностью даты.
 */
export function isDateFormatPrecision(value: string): value is DateFormatPrecision {
	return FORMAT_PRECISIONS.includes(value as DateFormatPrecision);
}

/**
 * Нормализует имя пресета, алиас style-формата или ручной шаблон.
 */
export function resolveDateFormatName(dateFormat?: string, defaultFormat: string = DATE_PRESET_NAME_DATE): string {
	const normalizedFormat = dateFormat?.trim();
	if (!normalizedFormat) return defaultFormat;

	return isDateFormatStyle(normalizedFormat) ? DATE_FORMAT_STYLE_PRESET_NAMES[normalizedFormat] : normalizedFormat;
}

/**
 * Создаёт кешируемый объектный пресет для ручного шаблона.
 */
function createPatternDatePreset(pattern: string, presetName: string, locale: string, invalidFallback: string): DateFormatPreset {
	const cacheKey = `${presetName}\u0000${locale}\u0000${invalidFallback}\u0000${pattern}`;
	const cachedPreset = patternPresetCache.get(cacheKey);
	if (cachedPreset) return cachedPreset;

	const preset = {
		name: `${presetName}:${pattern}`,
		pattern,
		locale,
		invalidFallback
	};

	patternPresetCache.set(cacheKey, preset);
	return preset;
}

export interface ResolveDateFormatPresetOptions {
	/**
	 * Формат по умолчанию, если входная строка пустая.
	 */
	defaultFormat?: string;
	/**
	 * Префикс имени для объектных пресетов ручных шаблонов.
	 */
	patternPresetName?: string;
	/**
	 * Локаль объектного пресета ручного шаблона.
	 */
	locale?: string;
	/**
	 * Fallback объектного пресета ручного шаблона.
	 */
	invalidFallback?: string;
}

/**
 * Возвращает зарегистрированный пресет или кешируемый объектный пресет для ручного шаблона.
 */
export function resolveDateFormatPreset(
	dateFormat?: string,
	{
		defaultFormat = DATE_PRESET_NAME_DATE,
		patternPresetName = "__date_pattern__",
		locale = DEFAULT_DATE_LOCALE,
		invalidFallback = ""
	}: ResolveDateFormatPresetOptions = {}
): string | DateFormatPreset {
	const resolvedFormat = resolveDateFormatName(dateFormat, defaultFormat);
	if (getDatePreset(resolvedFormat)) return resolvedFormat;

	return createPatternDatePreset(resolvedFormat, patternPresetName, locale, invalidFallback);
}

/**
 * Регистрирует или перезаписывает предустановку.
 */
export function registerDatePreset(config: DateFormatPresetConfig): DateFormatPreset {
	const preset = compileDatePreset(config);
	registry.set(preset.name, preset);
	return preset;
}

/**
 * Сбрасывает реестр к встроенному состоянию.
 */
export function resetDatePresets(): void {
	registry.clear();
	initPresets();
}
