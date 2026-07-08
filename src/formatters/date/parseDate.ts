import { DATE_PATTERN_TOKEN_RE, hasDatePatternTokens, resolveDatePatternPrecision } from "./pattern";
import { DATE_FORMAT_DEFAULTS, DEFAULT_DATE_PRESET_NAMES, getDatePreset, resolveDateFormatName } from "./presets";

import type { DateFormatPattern, DateFormatPrecision, ParsedDateTimeValue, ParsedDateValue } from "./types";

/**
 * Регулярное выражение для OData даты вида `/Date(1720137600000+0300)/`.
 */
const ODATA_TICKS_RE = /^\/Date\((-?\d+)([+-]\d{4})?\)\/$/;

/**
 * Регулярное выражение для OData литералов вида `datetime'2026-03-03T18:03:50'`.
 */
const ODATA_LITERAL_RE = /^(datetimeoffset|datetime)'(.+)'$/i;

/**
 * Регулярное выражение для ISO-даты без timezone.
 */
const ISO_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?)?$/;

/**
 * Регулярное выражение для даты с явным timezone.
 */
const ISO_ZONED_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Регулярное выражение для ABAP даты `YYYYMMDD`.
 */
const ABAP_COMPACT_RE = /^\d{8}$/;

/**
 * Регулярное выражение для ABAP timestamp `YYYYMMDDHHmmss...`.
 * Хвост после секунд содержит доли/служебные разряды и не влияет на календарное время.
 */
const ABAP_TIMESTAMP_RE = /^\d{14,}$/;

/**
 * Регулярное выражение для даты вида `DD.MM.YYYY`.
 */
const ABAP_DOTTED_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/**
 * Регулярное выражение для даты вида `MM/DD/YYYY`.
 */
const SLASH_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Регулярное выражение для ISO-8601 длительности.
 */
const ISO_DURATION_RE = /^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?)?$/;

/**
 * Набор строковых значений, трактуемых как пустые.
 */
const EMPTY_STRING_VALUES = new Set(["", "null", "undefined"]);

/**
 * Константы для расчёта длительностей.
 */
const MS_IN_SECOND = 1_000;
const MS_IN_MINUTE = 60_000;
const MS_IN_HOUR = 3_600_000;
const MS_IN_DAY = 86_400_000;
const APPROX_DAYS_IN_MONTH = 30;
const APPROX_DAYS_IN_YEAR = 365;
const TWO_DIGIT_YEAR_PIVOT = 70;

/**
 * Шаблоны ручного ввода для встроенных Intl-пресетов.
 */
const DATE_FORMAT_PARSE_PATTERNS: Readonly<Record<string, readonly DateFormatPattern[]>> = Object.freeze({
	[DEFAULT_DATE_PRESET_NAMES.date]: Object.freeze(["dd.MM.yyyy"] as const),
	[DEFAULT_DATE_PRESET_NAMES.dateShort]: Object.freeze(["dd.MM.yyyy"] as const),
	[DEFAULT_DATE_PRESET_NAMES.datetime]: Object.freeze(["dd.MM.yyyy HH:mm"] as const),
	[DEFAULT_DATE_PRESET_NAMES.datetimeSeconds]: Object.freeze(["dd.MM.yyyy HH:mm:ss"] as const),
	[DEFAULT_DATE_PRESET_NAMES.datetimeShort]: Object.freeze(["dd.MM.yyyy, HH:mm"] as const)
});

/**
 * Регулярное выражение для человекочитаемых дат вида `3 марта 2026 г.`.
 */
const LOCALIZED_DATE_RE = /^(\d{1,2})\s+([\p{L}.]+)\s+(\d{4})(?:\s*[\p{L}.]+)?(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/iu;
const LOCALIZED_DAY_MONTH_RE = /^(\d{1,2})\s+([\p{L}.]+)$/iu;
const LOCALIZED_MONTH_RE = /^([\p{L}.]+)\s+(\d{4})(?:\s*[\p{L}.]+)?$/iu;
const LOCALIZED_YEAR_RE = /^(\d{4})(?:\s*[\p{L}.]+)?$/iu;

const localizedMonthIndexCache = new Map<string, ReadonlyMap<string, number>>();
const DAY_MONTH_PRESET_NAMES = new Set<string>([DEFAULT_DATE_PRESET_NAMES.monthShort, DEFAULT_DATE_PRESET_NAMES.monthLong]);

/**
 * Создаёт календарную дату без timezone-семантики и валидирует компоненты.
 */
function createCalendarDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0): Date | null {
	const result = new Date(year, month - 1, day, hour, minute, second, millisecond);
	const isValid =
		result.getFullYear() === year &&
		result.getMonth() === month - 1 &&
		result.getDate() === day &&
		result.getHours() === hour &&
		result.getMinutes() === minute &&
		result.getSeconds() === second;

	return isValid ? result : null;
}

/**
 * Нормализует имя месяца из Intl-форматтера для обратного парсинга.
 */
function normalizeLocalizedMonthName(monthName: string, locale: string): string {
	return monthName.toLocaleLowerCase(locale).replace(/\.$/, "");
}

/**
 * Добавляет имя месяца в runtime-словарь локали.
 */
function addLocalizedMonthName(monthIndex: Map<string, number>, monthName: string, index: number, locale: string): void {
	monthIndex.set(normalizeLocalizedMonthName(monthName, locale), index);
}

/**
 * Добавляет имя месяца из formatToParts, чтобы учитывать падеж в составе полной даты.
 */
function addLocalizedMonthPart(
	monthIndex: Map<string, number>,
	formatter: Intl.DateTimeFormat,
	date: Date,
	index: number,
	locale: string
): void {
	const monthPart = formatter.formatToParts(date).find((part) => part.type === "month");
	if (monthPart) addLocalizedMonthName(monthIndex, monthPart.value, index, locale);
}

/**
 * Собирает словарь названий месяцев через Intl.DateTimeFormat для заданной локали.
 */
function getLocalizedMonthIndex(locale: string): ReadonlyMap<string, number> {
	const cachedIndex = localizedMonthIndexCache.get(locale);
	if (cachedIndex) return cachedIndex;

	const monthIndex = new Map<string, number>();
	const shortFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
	const longFormatter = new Intl.DateTimeFormat(locale, { month: "long" });
	const shortDateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
	const longDateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });

	for (let month = 0; month < 12; month += 1) {
		const date = new Date(2026, month, 1);
		addLocalizedMonthName(monthIndex, shortFormatter.format(date), month, locale);
		addLocalizedMonthName(monthIndex, longFormatter.format(date), month, locale);
		addLocalizedMonthPart(monthIndex, shortDateFormatter, date, month, locale);
		addLocalizedMonthPart(monthIndex, longDateFormatter, date, month, locale);
	}

	localizedMonthIndexCache.set(locale, monthIndex);
	return monthIndex;
}

/**
 * Парсит человекочитаемую дату, сформированную Intl-пресетами текущей локали.
 */
function parseLocalizedDayString(value: string, locale: string): ParsedDateTimeValue | null {
	const match = LOCALIZED_DATE_RE.exec(value.trim());
	if (!match) return null;

	const day = Number(match[1]);
	const monthIndex = getLocalizedMonthIndex(locale).get(normalizeLocalizedMonthName(match[2], locale));
	const year = Number(match[3]);
	const hour = Number(match[4] ?? 0);
	const minute = Number(match[5] ?? 0);
	const second = Number(match[6] ?? 0);

	if (monthIndex === undefined) return null;
	if (!Number.isFinite(day) || !Number.isFinite(year) || !Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
		return null;
	}

	const parsed = createCalendarDate(year, monthIndex + 1, day, hour, minute, second);
	return parsed ? asDateTimeValue(parsed, "iso-local") : null;
}

/**
 * Парсит человекочитаемую дату без года, сформированную day+month-пресетами.
 */
function parseLocalizedDayMonthString(value: string, locale: string, year: number): ParsedDateTimeValue | null {
	const match = LOCALIZED_DAY_MONTH_RE.exec(value.trim());
	if (!match) return null;

	const day = Number(match[1]);
	const monthIndex = getLocalizedMonthIndex(locale).get(normalizeLocalizedMonthName(match[2], locale));

	if (monthIndex === undefined || !Number.isFinite(day)) {
		return null;
	}

	const parsed = createCalendarDate(year, monthIndex + 1, day);
	return parsed ? asDateTimeValue(parsed, "iso-local") : null;
}

/**
 * Парсит человекочитаемый месяц, сформированный Intl-пресетами текущей локали.
 */
function parseLocalizedMonthString(value: string, locale: string): ParsedDateTimeValue | null {
	const match = LOCALIZED_MONTH_RE.exec(value.trim());
	if (!match) return null;

	const monthIndex = getLocalizedMonthIndex(locale).get(normalizeLocalizedMonthName(match[1], locale));
	const year = Number(match[2]);

	if (monthIndex === undefined || !Number.isFinite(year)) return null;

	const parsed = createCalendarDate(year, monthIndex + 1, 1);
	return parsed ? asDateTimeValue(parsed, "iso-local") : null;
}

/**
 * Парсит человекочитаемый год, сформированный Intl-пресетами текущей локали.
 */
function parseLocalizedYearString(value: string): ParsedDateTimeValue | null {
	const match = LOCALIZED_YEAR_RE.exec(value.trim());
	if (!match) return null;

	const year = Number(match[1]);
	if (!Number.isFinite(year)) return null;

	const parsed = createCalendarDate(year, 1, 1);
	return parsed ? asDateTimeValue(parsed, "iso-local") : null;
}

/**
 * Парсит человекочитаемую дату с учётом точности календарного значения.
 */
function parseLocalizedDateString(value: string, locale: string, precision: DateFormatPrecision): ParsedDateTimeValue | null {
	if (precision === "year") return parseLocalizedYearString(value);
	if (precision === "month") return parseLocalizedMonthString(value, locale);

	return parseLocalizedDayString(value, locale);
}

/**
 * Проверяет, что формат может быть распарсен как `день месяц` без года.
 */
function isDayMonthPresetName(dateFormat: string): boolean {
	return DAY_MONTH_PRESET_NAMES.has(dateFormat);
}

/**
 * Возвращает опорный год для пресетов без года.
 */
function resolveReferenceYear(referenceDate: Date | undefined): number {
	if (referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())) {
		return referenceDate.getFullYear();
	}

	return new Date().getFullYear();
}

/**
 * Пересобирает `Date` в календарную дату через локальные компоненты.
 */
function cloneCalendarDate(date: Date): Date {
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		date.getHours(),
		date.getMinutes(),
		date.getSeconds(),
		date.getMilliseconds()
	);
}

/**
 * Пересобирает `Date` в календарную дату через UTC-компоненты.
 *
 * Используется для источников, где дата уже пришла как instant,
 * но визуальные компоненты нужно сохранить без timezone-сдвига.
 */
function cloneUtcCalendarDate(date: Date): Date {
	return new Date(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds()
	);
}

/**
 * Формирует результат парсинга календарной даты/времени.
 */
function asDateTimeValue(date: Date, source: ParsedDateTimeValue["source"]): ParsedDateTimeValue {
	return { kind: "date-time", source, date };
}

/**
 * Парсит timestamp (секунды или миллисекунды Unix epoch).
 */
function parseTimestamp(value: number): ParsedDateTimeValue | null {
	if (!Number.isFinite(value)) return null;

	const timestamp = Math.abs(value) < 1e12 ? value * 1_000 : value;
	const parsed = new Date(timestamp);
	if (Number.isNaN(parsed.getTime())) return null;

	return asDateTimeValue(cloneUtcCalendarDate(parsed), "timestamp");
}

/**
 * Парсит OData ticks и учитывает смещение, если оно передано.
 */
function parseODataTicks(value: string): ParsedDateTimeValue | null {
	const match = ODATA_TICKS_RE.exec(value);
	if (!match) return null;

	const timestamp = Number(match[1]);
	if (!Number.isFinite(timestamp)) return null;

	const offset = match[2];
	if (!offset) return asDateTimeValue(cloneUtcCalendarDate(new Date(timestamp)), "odata-ticks");

	const sign = offset.startsWith("-") ? -1 : 1;
	const hours = Number(offset.slice(1, 3));
	const minutes = Number(offset.slice(3, 5));
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

	const offsetMs = sign * (hours * MS_IN_HOUR + minutes * MS_IN_MINUTE);
	return asDateTimeValue(cloneUtcCalendarDate(new Date(timestamp + offsetMs)), "odata-ticks");
}

/**
 * Парсит даты без timezone в ISO-подобных форматах.
 */
function parseIsoLocal(value: string): ParsedDateTimeValue | null {
	const match = ISO_LOCAL_RE.exec(value);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4] ?? 0);
	const minute = Number(match[5] ?? 0);
	const second = Number(match[6] ?? 0);
	const millisecondsRaw = (match[7] ?? "").slice(0, 3).padEnd(3, "0");
	const millisecond = Number(millisecondsRaw || 0);

	const parsed = createCalendarDate(year, month, day, hour, minute, second, millisecond);
	return parsed ? asDateTimeValue(parsed, "iso-local") : null;
}

/**
 * Парсит даты с явным timezone.
 */
function parseIsoZoned(value: string): ParsedDateTimeValue | null {
	if (!ISO_ZONED_RE.test(value)) return null;

	const normalizedValue = value.replace(ISO_ZONED_RE, "");
	const parsed = parseIsoLocal(normalizedValue);
	return parsed ? asDateTimeValue(parsed.date, "iso-zoned") : null;
}

/**
 * Парсит ABAP дату формата `YYYYMMDD`.
 */
function parseAbapCompact(value: string): ParsedDateTimeValue | null {
	if (!ABAP_COMPACT_RE.test(value)) return null;

	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(4, 6));
	const day = Number(value.slice(6, 8));

	const parsed = createCalendarDate(year, month, day);
	return parsed ? asDateTimeValue(parsed, "abap-compact") : null;
}

/**
 * Парсит ABAP timestamp формата `YYYYMMDDHHmmss...`.
 */
function parseAbapTimestamp(value: string): ParsedDateTimeValue | null {
	if (!ABAP_TIMESTAMP_RE.test(value)) return null;

	const year = Number(value.slice(0, 4));
	const month = Number(value.slice(4, 6));
	const day = Number(value.slice(6, 8));
	const hour = Number(value.slice(8, 10));
	const minute = Number(value.slice(10, 12));
	const second = Number(value.slice(12, 14));

	const parsed = createCalendarDate(year, month, day, hour, minute, second);
	return parsed ? asDateTimeValue(parsed, "abap-timestamp") : null;
}

/**
 * Парсит дату формата `DD.MM.YYYY`.
 */
function parseAbapDotted(value: string): ParsedDateTimeValue | null {
	const match = ABAP_DOTTED_RE.exec(value);
	if (!match) return null;

	const day = Number(match[1]);
	const month = Number(match[2]);
	const year = Number(match[3]);

	const parsed = createCalendarDate(year, month, day);
	return parsed ? asDateTimeValue(parsed, "abap-dotted") : null;
}

/**
 * Парсит дату формата `MM/DD/YYYY`.
 */
function parseSlashDate(value: string): ParsedDateTimeValue | null {
	const match = SLASH_DATE_RE.exec(value);
	if (!match) return null;

	const month = Number(match[1]);
	const day = Number(match[2]);
	const year = Number(match[3]);

	const parsed = createCalendarDate(year, month, day);
	return parsed ? asDateTimeValue(parsed, "slash-date") : null;
}

/**
 * Парсит OData литералы `datetime'...'` и `datetimeoffset'...'`.
 */
function parseODataLiteral(value: string): ParsedDateTimeValue | null {
	const match = ODATA_LITERAL_RE.exec(value);
	if (!match) return null;

	const innerValue = match[2].trim();
	return parseDateString(innerValue, "odata-literal");
}

/**
 * Парсит ISO-8601 длительность.
 *
 * Для год/месяц используется приближение: 365 и 30 суток соответственно.
 */
function parseIsoDuration(value: string): ParsedDateValue | null {
	const match = ISO_DURATION_RE.exec(value);
	if (!match) return null;

	const sign = match[1] === "-" ? -1 : 1;
	const years = Number(match[2] ?? 0);
	const months = Number(match[3] ?? 0);
	const days = Number(match[4] ?? 0);
	const hours = Number(match[5] ?? 0);
	const minutes = Number(match[6] ?? 0);
	const seconds = Number(match[7] ?? 0);
	const fractionRaw = (match[8] ?? "").slice(0, 3).padEnd(3, "0");
	const milliseconds = Number(fractionRaw || 0);

	const hasAnyComponent = Boolean(years || months || days || hours || minutes || seconds || milliseconds);
	if (!hasAnyComponent) return null;

	const durationMs =
		sign *
		(years * APPROX_DAYS_IN_YEAR * MS_IN_DAY +
			months * APPROX_DAYS_IN_MONTH * MS_IN_DAY +
			days * MS_IN_DAY +
			hours * MS_IN_HOUR +
			minutes * MS_IN_MINUTE +
			seconds * MS_IN_SECOND +
			milliseconds);

	return { kind: "duration", source: "iso-duration", durationMs };
}

/**
 * Перезаписывает источник, если требуется проставить контекст вызова.
 */
function withSourceOverride(value: ParsedDateTimeValue, sourceOverride?: ParsedDateTimeValue["source"]): ParsedDateTimeValue {
	return sourceOverride ? { ...value, source: sourceOverride } : value;
}

/**
 * Парсит строку в дату.
 */
function parseDateString(value: string, sourceOverride?: ParsedDateTimeValue["source"]): ParsedDateTimeValue | null {
	const zoned = parseIsoZoned(value);
	if (zoned) return withSourceOverride(zoned, sourceOverride);

	const localIso = parseIsoLocal(value);
	if (localIso) return withSourceOverride(localIso, sourceOverride);

	const dotted = parseAbapDotted(value);
	if (dotted) return withSourceOverride(dotted, sourceOverride);

	const slashed = parseSlashDate(value);
	if (slashed) return withSourceOverride(slashed, sourceOverride);

	const timestamp = parseAbapTimestamp(value);
	if (timestamp) return withSourceOverride(timestamp, sourceOverride);

	const compact = parseAbapCompact(value);
	if (compact) return withSourceOverride(compact, sourceOverride);

	const timestampAsNumber = Number(value);
	if (/^-?\d+$/.test(value) && Number.isFinite(timestampAsNumber)) {
		const timestamp = parseTimestamp(timestampAsNumber);
		if (timestamp) return withSourceOverride(timestamp, sourceOverride);
	}

	return null;
}

/**
 * Экранирует литерал для безопасной подстановки в регулярное выражение.
 */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Преобразует двузначный год в четырёхзначный.
 *
 * Значения `00-69` трактуются как `2000-2069`,
 * значения `70-99` трактуются как `1970-1999`.
 */
function resolveTwoDigitYear(year: number): number {
	return year < TWO_DIGIT_YEAR_PIVOT ? 2000 + year : 1900 + year;
}

/**
 * Парсит строку по пользовательскому шаблону даты.
 *
 * Поддерживаются токены `dd`, `MM`, `yyyy`, `yy`, `HH`, `mm` и `ss`.
 */
export interface ParseDateByPatternOptions {
	/**
	 * Точность календарной даты.
	 */
	precision?: DateFormatPrecision;
}

export function parseDateByPattern(
	value: unknown,
	pattern = "dd.MM.yyyy",
	options: ParseDateByPatternOptions = {}
): ParsedDateValue | null {
	if (typeof value !== "string") {
		return parseDateValue(value);
	}

	const trimmed = value.trim();
	if (EMPTY_STRING_VALUES.has(trimmed.toLowerCase())) return null;

	const precision = options.precision ?? "day";
	const precisionPattern = resolveDatePatternPrecision(pattern, precision);
	const captureNames: string[] = [];
	let cursor = 0;
	let regexPattern = "^";
	let matchPart: RegExpExecArray | null = null;

	DATE_PATTERN_TOKEN_RE.lastIndex = 0;

	while ((matchPart = DATE_PATTERN_TOKEN_RE.exec(precisionPattern)) !== null) {
		regexPattern += escapeRegExp(precisionPattern.slice(cursor, matchPart.index));
		captureNames.push(matchPart[0]);

		if (matchPart[0] === "yyyy") regexPattern += "(\\d{4})";
		else regexPattern += "(\\d{2})";

		cursor = matchPart.index + matchPart[0].length;
	}

	if (captureNames.length === 0) return null;

	regexPattern += `${escapeRegExp(precisionPattern.slice(cursor))}$`;
	const regex = new RegExp(regexPattern);
	const match = regex.exec(trimmed);
	if (!match) return null;

	let year: number | null = null;
	let month: number | null = null;
	let day: number | null = null;
	let hour = 0;
	let minute = 0;
	let second = 0;

	for (let index = 0; index < captureNames.length; index += 1) {
		const token = captureNames[index];
		const rawValue = match[index + 1];
		const numericValue = Number(rawValue);
		if (!Number.isFinite(numericValue)) return null;

		if (token === "yyyy") year = numericValue;
		if (token === "yy") year = resolveTwoDigitYear(numericValue);
		if (token === "MM") month = numericValue;
		if (token === "dd") day = numericValue;
		if (token === "HH") hour = numericValue;
		if (token === "mm") minute = numericValue;
		if (token === "ss") second = numericValue;
	}

	if (!year) return null;
	if (precision !== "year" && !month) return null;
	if (precision === "day" && !day) return null;

	const parsed = createCalendarDate(year, month ?? 1, day ?? 1, hour, minute, second);
	return parsed ? asDateTimeValue(parsed, "iso-local") : null;
}

export interface ParseDateByFormatOptions {
	/**
	 * Формат по умолчанию, если входной формат не задан.
	 */
	defaultFormat?: DateFormatPattern;
	/**
	 * Локаль для обратного парсинга человекочитаемых Intl-строк.
	 */
	locale?: string;
	/**
	 * Точность календарной даты.
	 */
	precision?: DateFormatPrecision;
	/**
	 * Опорная дата для пресетов без года, например `month-long`.
	 */
	referenceDate?: Date;
}

/**
 * Возвращает набор строгих шаблонов для парсинга по имени пресета или ручному формату.
 */
function getDateFormatParsePatterns(dateFormat: string, precision: DateFormatPrecision): readonly DateFormatPattern[] {
	const preset = getDatePreset(dateFormat);
	const presetPatterns = DATE_FORMAT_PARSE_PATTERNS[dateFormat];

	if (preset?.pattern) return [resolveDatePatternPrecision(preset.pattern, precision)];
	if (presetPatterns) return presetPatterns.map((pattern) => resolveDatePatternPrecision(pattern, precision));
	if (!preset && hasDatePatternTokens(dateFormat)) return [resolveDatePatternPrecision(dateFormat, precision)];

	return [];
}

/**
 * Парсит календарную дату по имени пресета, style-алиасу или ручному шаблону.
 */
export function parseDateByFormat(value: unknown, dateFormat?: string, options: ParseDateByFormatOptions = {}): ParsedDateTimeValue | null {
	if (typeof value !== "string") {
		const parsed = parseDateValue(value);
		return parsed?.kind === "date-time" ? parsed : null;
	}

	const trimmed = value.trim();
	if (EMPTY_STRING_VALUES.has(trimmed.toLowerCase())) return null;

	const precision = options.precision ?? "day";
	const resolvedFormat = resolveDateFormatName(dateFormat, options.defaultFormat ?? DEFAULT_DATE_PRESET_NAMES.date);
	for (const pattern of getDateFormatParsePatterns(resolvedFormat, precision)) {
		const parsedByPattern = parseDateByPattern(trimmed, pattern, { precision });
		if (parsedByPattern?.kind === "date-time") return parsedByPattern;
	}

	if (precision === "day") {
		const parsedByValue = parseDateValue(trimmed);
		if (parsedByValue?.kind === "date-time") return parsedByValue;
	}

	const preset = getDatePreset(resolvedFormat);
	const locale = preset?.locale ?? options.locale ?? DATE_FORMAT_DEFAULTS.locale;

	if (precision === "day" && isDayMonthPresetName(resolvedFormat)) {
		const parsedDayMonth = parseLocalizedDayMonthString(trimmed, locale, resolveReferenceYear(options.referenceDate));
		if (parsedDayMonth) return parsedDayMonth;
	}

	return parseLocalizedDateString(trimmed, locale, precision);
}

/**
 * Универсально парсит вход даты/времени из `unknown`.
 */
export function parseDateValue(value: unknown): ParsedDateValue | null {
	if (value == null) return null;

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return asDateTimeValue(cloneCalendarDate(value), "date-object");
	}

	if (typeof value === "number") {
		return parseTimestamp(value);
	}

	if (typeof value !== "string") return null;

	const trimmed = value.trim();
	if (EMPTY_STRING_VALUES.has(trimmed.toLowerCase())) return null;

	const odataTicks = parseODataTicks(trimmed);
	if (odataTicks) return odataTicks;

	const odataLiteral = parseODataLiteral(trimmed);
	if (odataLiteral) return odataLiteral;

	const duration = parseIsoDuration(trimmed);
	if (duration) return duration;

	return parseDateString(trimmed);
}

/**
 * Преобразует результат парсинга к `Date`, в том числе для duration-значений.
 *
 * Для duration используется та же "плавающая" календарная семантика, что и для timestamp:
 * UTC-компоненты пересобираются в локальный `Date`, чтобы не появлялся timezone-сдвиг.
 */
function coerceParsedDateToDate(value: ParsedDateValue | null): Date | null {
	if (!value) return null;
	if (value.kind === "date-time") return value.date;

	const durationDate = new Date(value.durationMs);
	if (Number.isNaN(durationDate.getTime())) return null;

	return cloneUtcCalendarDate(durationDate);
}

/**
 * Универсально парсит вход и всегда возвращает `Date | null`.
 */
export function parseDate(value: unknown): Date | null {
	return coerceParsedDateToDate(parseDateValue(value));
}
