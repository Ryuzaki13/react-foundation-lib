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
 * Локаль форматирования дат по умолчанию.
 */
const DEFAULT_LOCALE = "ru-RU";

/**
 * Уровни детализации, для которых создаются встроенные style-пресеты.
 */
const FORMAT_STYLES = Object.freeze(["short", "medium", "long"] as const);
const FORMAT_PRECISIONS = Object.freeze(["day", "month", "year"] as const);

/**
 * Значения по умолчанию для предустановок форматирования дат.
 */
export const DATE_FORMAT_DEFAULTS: Omit<DateFormatPreset, "name" | "intlOptions"> & { intlOptions: Intl.DateTimeFormatOptions } = {
	locale: DEFAULT_LOCALE,
	intlOptions: { day: "2-digit", month: "2-digit", year: "numeric" },
	invalidFallback: ""
};

/**
 * Имена встроенных предустановок.
 */
export const DEFAULT_DATE_PRESET_NAMES = Object.freeze({
	date: "date",
	dateShort: "date-short",
	dateMedium: "date-medium",
	dateLong: "date-long",
	monthShort: "month-short",
	monthLong: "month-long",
	datetime: "datetime",
	datetimeSeconds: "datetime-seconds",
	datetimeShort: "datetime-short",
	datetimeMedium: "datetime-medium",
	datetimeLong: "datetime-long",
	time: "time",
	timeSeconds: "time-seconds",
	timeShort: "time-short",
	timeMedium: "time-medium",
	timeLong: "time-long",
	odataDate: "odata-date",
	odataDatetime: "odata-datetime",
	abapDatetime: "abap-datetime",
	abapDate: "abap-date",
	abapMonth: "abap-month",
	abapYear: "abap-year"
});

/**
 * Алиасы style-форматов даты к именам встроенных date-пресетов.
 */
export const DATE_FORMAT_STYLE_PRESET_NAMES: Readonly<Record<DateFormatStyle, string>> = Object.freeze({
	short: DEFAULT_DATE_PRESET_NAMES.dateShort,
	medium: DEFAULT_DATE_PRESET_NAMES.dateMedium,
	long: DEFAULT_DATE_PRESET_NAMES.dateLong
});

const patternPresetCache = new Map<string, DateFormatPreset>();

/**
 * Встроенные предустановки форматирования дат.
 */
const BUILTIN_PRESETS: DateFormatPresetConfig[] = [
	{ name: DEFAULT_DATE_PRESET_NAMES.date, intlOptions: { day: "2-digit", month: "2-digit", year: "numeric" } },
	{
		name: DEFAULT_DATE_PRESET_NAMES.datetime,
		intlDateOptions: { day: "2-digit", month: "2-digit", year: "numeric" },
		intlTimeOptions: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
		intlJoiner: " "
	},
	{
		name: DEFAULT_DATE_PRESET_NAMES.datetimeSeconds,
		intlDateOptions: { day: "2-digit", month: "2-digit", year: "numeric" },
		intlTimeOptions: { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" },
		intlJoiner: " "
	},
	{
		name: DEFAULT_DATE_PRESET_NAMES.time,
		intlOptions: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
		durationPattern: "HH:mm"
	},
	{
		name: DEFAULT_DATE_PRESET_NAMES.timeSeconds,
		intlOptions: { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" },
		durationPattern: "HH:mm:ss"
	},
	...FORMAT_STYLES.map((style) => ({
		name: `date-${style}`,
		intlOptions: getDateStyleIntlOptions(style)
	})),
	{
		name: DEFAULT_DATE_PRESET_NAMES.monthShort,
		intlOptions: { day: "numeric", month: "short" }
	},
	{
		name: DEFAULT_DATE_PRESET_NAMES.monthLong,
		intlOptions: { day: "numeric", month: "long" }
	},
	...FORMAT_STYLES.map((style) => ({
		name: `time-${style}`,
		intlOptions: getTimeStyleIntlOptions(style),
		durationPattern: style === "short" ? "HH:mm" : "HH:mm:ss"
	})),
	...FORMAT_STYLES.map((style) => ({
		name: `datetime-${style}`,
		intlDateOptions: getDateStyleIntlOptions(style),
		intlTimeOptions: getTimeStyleIntlOptions(style),
		intlJoiner: ", "
	})),
	{ name: DEFAULT_DATE_PRESET_NAMES.odataDate, pattern: "yyyy-MM-dd" },
	{ name: DEFAULT_DATE_PRESET_NAMES.odataDatetime, pattern: "yyyy-MM-ddTHH:mm:ss" },
	{ name: DEFAULT_DATE_PRESET_NAMES.abapDatetime, pattern: "yyyyMMddHHmmss" },
	{ name: DEFAULT_DATE_PRESET_NAMES.abapDate, pattern: "yyyyMMdd" },
	{ name: DEFAULT_DATE_PRESET_NAMES.abapMonth, pattern: "yyyyMM" },
	{ name: DEFAULT_DATE_PRESET_NAMES.abapYear, pattern: "yyyy" }
];

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
function getDateStyleIntlOptions(style: DateFormatStyle, precision: DateFormatPrecision = "day"): Intl.DateTimeFormatOptions {
	if (precision === "year") return { year: "numeric" };

	if (precision === "month") {
		if (style === "short") return { month: "2-digit", year: "numeric" };
		if (style === "medium") return { month: "short", year: "numeric" };
		return { month: "long", year: "numeric" };
	}

	if (style === "short") return { day: "2-digit", month: "2-digit", year: "numeric" };
	if (style === "medium") return { day: "numeric", month: "short", year: "numeric" };
	return { day: "numeric", month: "long", year: "numeric" };
}

/**
 * Возвращает настройки Intl для timeStyle-подобного формата без timezoneName.
 *
 * Intl timeStyle="long" добавляет часовой пояс в результат. В этом модуле
 * timezone намеренно не существует, поэтому long повторяет секундную точность
 * без вывода GMT/UTC-метки.
 */
function getTimeStyleIntlOptions(style: DateFormatStyle): Intl.DateTimeFormatOptions {
	if (style === "short") return { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
	return { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" };
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
	if (precision === "day" || !hasIntlDateFields(safeOptions)) return safeOptions;

	if (safeOptions.dateStyle) {
		const style = safeOptions.dateStyle === "short" || safeOptions.dateStyle === "medium" ? safeOptions.dateStyle : "long";
		return getDateStyleIntlOptions(style, precision);
	}

	if (precision === "year") {
		return { year: safeOptions.year ?? "numeric" };
	}

	return {
		month: safeOptions.month ?? "2-digit",
		year: safeOptions.year ?? "numeric"
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
		const timeOptions = getTimeStyleIntlOptions(safeOptions.timeStyle === "short" ? "short" : "medium");

		if (safeOptions.dateStyle) {
			const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: safeOptions.dateStyle });
			const timeFormatter = new Intl.DateTimeFormat(locale, timeOptions);
			return (date, precision = "day") => {
				if (precision === "day") return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;

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
	return (date, precision = "day") => {
		if (precision === "day") return defaultFormatter.format(date);

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
		case "yyyy":
			return fullYear;
		case "yy":
			return fullYear.slice(-2);
		case "MM":
			return padDatePart(date.getMonth() + 1);
		case "dd":
			return padDatePart(date.getDate());
		case "HH":
			return padDatePart(date.getHours());
		case "mm":
			return padDatePart(date.getMinutes());
		case "ss":
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
		case "yyyyMMdd":
			return (date) => `${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}`;
		case "yyyyMMddHHmmss":
			return (date) =>
				`${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}${padDatePart(date.getHours())}${padDatePart(
					date.getMinutes()
				)}${padDatePart(date.getSeconds())}`;
		case "yyyy-MM-dd":
			return (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
		case "yyyy-MM-ddTHH:mm:ss":
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

	return (date, precision = "day") => {
		let formatter = precisionFormatters.get(precision);
		if (!formatter) {
			formatter = compileFixedPatternFormatter(resolveDatePatternPrecision(pattern, precision));
			precisionFormatters.set(precision, formatter);
		}

		return formatter(date, "day");
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
	const absoluteSeconds = Math.trunc(Math.abs(durationMs) / 1_000);
	const hours = Math.trunc(absoluteSeconds / 3_600);
	const minutes = Math.trunc((absoluteSeconds % 3_600) / 60);
	const seconds = absoluteSeconds % 60;

	if (pattern === "HH:mm") return `${sign}${padDatePart(hours)}:${padDatePart(minutes)}`;
	if (pattern === "HH:mm:ss") return `${sign}${padDatePart(hours)}:${padDatePart(minutes)}:${padDatePart(seconds)}`;

	return (
		sign + pattern.replaceAll("HH", padDatePart(hours)).replaceAll("mm", padDatePart(minutes)).replaceAll("ss", padDatePart(seconds))
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

		return (date, precision = "day") => {
			if (precision !== "day") return dateFormatter(date, precision);
			return `${dateFormatter(date)}${joiner}${timeFormatter(date)}`;
		};
	}

	return createIntlFormatter(preset.locale, preset.intlOptions ?? DATE_FORMAT_DEFAULTS.intlOptions);
}

/**
 * Инициализирует реестр встроенными предустановками.
 */
function initPresets(): void {
	for (const config of BUILTIN_PRESETS) {
		registry.set(config.name, compileDatePreset(config));
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
export function resolveDateFormatName(dateFormat?: string, defaultFormat: string = DEFAULT_DATE_PRESET_NAMES.date): string {
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
		defaultFormat = DEFAULT_DATE_PRESET_NAMES.date,
		patternPresetName = "__date_pattern__",
		locale = DEFAULT_LOCALE,
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
