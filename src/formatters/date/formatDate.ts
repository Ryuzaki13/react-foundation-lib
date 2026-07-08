import { parseDateValue } from "./parseDate";
import { compileDatePreset, CompiledDateFormatPreset, DEFAULT_DATE_PRESET_NAMES, getCompiledDatePreset } from "./presets";
import { DateFormatPrecision, DateFormatPreset, FormatDateOptions, ParsedDateValue } from "./types";

/**
 * Кеш скомпилированных объектных предустановок.
 *
 * Именованные предустановки компилируются в реестре, а объектные могут
 * передаваться напрямую в горячем пути таблиц. WeakMap сохраняет готовый
 * Intl.DateTimeFormat на время жизни объекта и не мешает сборке мусора.
 */
const objectPresetCache = new WeakMap<DateFormatPreset, CompiledDateFormatPreset>();

/**
 * Дополняет числовую часть даты ведущим нулём.
 */
function padDatePart(value: number): string {
	return String(value).padStart(2, "0");
}

/**
 * Разрешает предустановку по имени или объекту.
 */
function resolvePreset(presetOrName: string | DateFormatPreset): CompiledDateFormatPreset {
	if (typeof presetOrName !== "string") {
		const cachedPreset = objectPresetCache.get(presetOrName);
		if (cachedPreset) return cachedPreset;

		const compiledPreset = compileDatePreset(presetOrName);
		objectPresetCache.set(presetOrName, compiledPreset);
		return compiledPreset;
	}

	const preset = getCompiledDatePreset(presetOrName);
	if (!preset) {
		throw new Error(`Предустановка даты "${presetOrName}" не найдена`);
	}
	return preset;
}

/**
 * Определяет fallback с учётом опций вызова и предустановки.
 */
function resolveFallback(preset: CompiledDateFormatPreset, options?: FormatDateOptions): string {
	return options?.fallback ?? preset.invalidFallback;
}

/**
 * Форматирует уже распарсенное значение.
 */
function formatParsedValue(
	parsed: ParsedDateValue,
	preset: CompiledDateFormatPreset,
	fallback: string,
	precision: DateFormatPrecision
): string {
	if (parsed.kind === "duration") {
		return preset.formatDuration ? preset.formatDuration(parsed.durationMs, fallback) : fallback;
	}

	return preset.formatDateTime(parsed.date, precision);
}

/**
 * Универсально форматирует дату/время по предустановке или её имени.
 */
export function formatDate(
	value: unknown,
	presetOrName: string | DateFormatPreset = DEFAULT_DATE_PRESET_NAMES.date,
	options?: FormatDateOptions
): string {
	const preset = resolvePreset(presetOrName);
	const fallback = resolveFallback(preset, options);
	const precision = options?.precision ?? "day";
	const parsed = parseDateValue(value);

	if (!parsed) return fallback;
	return formatParsedValue(parsed, preset, fallback, precision);
}

/**
 * Форматирует значение как дату `dd.MM.yyyy`.
 */
export function formatDateAsDate(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.date, options);
}

/**
 * Форматирует значение как дату и время `dd.MM.yyyy HH:mm`.
 */
export function formatDateAsDateTime(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.datetime, options);
}

/**
 * Форматирует значение как время `HH:mm`.
 */
export function formatDateAsTime(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.time, options);
}

/**
 * Форматирует значение как время `HH:mm:ss`.
 */
export function formatDateAsTimeSeconds(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.timeSeconds, options);
}

/**
 * Форматирует значение как короткую дату `03.03.2026`.
 */
export function formatDateAsDateShort(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.dateShort, options);
}

/**
 * Форматирует значение как среднюю дату `3 мар. 2026 г.`.
 */
export function formatDateAsDateMedium(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.dateMedium, options);
}

/**
 * Форматирует значение как длинную дату `3 марта 2026 г.`.
 */
export function formatDateAsDateLong(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.dateLong, options);
}

/**
 * Форматирует значение как короткую дату без года `3 мар.`.
 */
export function formatDateAsMonthShort(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.monthShort, options);
}

/**
 * Форматирует значение как длинную дату без года `3 марта`.
 */
export function formatDateAsMonthLong(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.monthLong, options);
}

/**
 * Форматирует значение как короткое время `18:03`.
 */
export function formatDateAsTimeShort(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.timeShort, options);
}

/**
 * Форматирует значение как среднее время `18:03:50`.
 */
export function formatDateAsTimeMedium(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.timeMedium, options);
}

/**
 * Форматирует значение как длинное время `18:03:50`.
 */
export function formatDateAsTimeLong(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.timeLong, options);
}

/**
 * Форматирует значение как короткую дату и время `03.03.2026 18:03`.
 */
export function formatDateAsDatetimeShort(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.datetimeShort, options);
}

/**
 * Форматирует значение как среднюю дату и время `3 мар. 2026 г. 18:03:50`.
 */
export function formatDateAsDatetimeMedium(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.datetimeMedium, options);
}

/**
 * Форматирует значение как длинную дату и время `3 марта 2026 г. 18:03:50`.
 */
export function formatDateAsDatetimeLong(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.datetimeLong, options);
}

/**
 * Форматирует диапазон дат через разделитель ` - `.
 */
export function formatDateRange(
	startValue: unknown,
	endValue: unknown,
	presetOrName: string | DateFormatPreset = DEFAULT_DATE_PRESET_NAMES.date,
	options?: FormatDateOptions
): string {
	const preset = resolvePreset(presetOrName);
	const fallback = resolveFallback(preset, options);
	const precision = options?.precision ?? "day";

	const startParsed = parseDateValue(startValue);
	const endParsed = parseDateValue(endValue);
	if (!startParsed || !endParsed) return fallback;

	const start = formatParsedValue(startParsed, preset, fallback, precision);
	const end = formatParsedValue(endParsed, preset, fallback, precision);
	if (!start || !end) return fallback;

	return `${start} - ${end}`;
}

/**
 * Форматирует значение как год `yyyy`.
 */
export function formatDateAsAbapYear(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.abapYear, options);
}

/**
 * Форматирует значение как календарный месяц `yyyyMM`.
 */
export function formatDateAsAbapMonth(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.abapMonth, options);
}

/**
 * Форматирует значение как дату `yyyyMMdd`.
 */
export function formatDateAsAbapDate(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.abapDate, options);
}

/**
 * Форматирует значение как дату `yyyyMMddHHmmss`.
 */
export function formatDateAsAbapDatetime(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.abapDatetime, options);
}

/**
 * Форматирует значение как дату `yyyy-MM-dd`.
 */
export function formatDateAsODataDate(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.odataDate, options);
}

/**
 * Форматирует значение как дату и время `yyyy-MM-ddTHH:mm:ss`.
 */
export function formatDateAsODataDatetime(value: unknown, options?: FormatDateOptions): string {
	return formatDate(value, DEFAULT_DATE_PRESET_NAMES.odataDatetime, options);
}

/**
 * Форматирует значение как время `PT00H00M00S`.
 */
export function formatDateAsODataTime(value: unknown, options?: FormatDateOptions): string {
	const fallback = options?.fallback ?? "";
	const parsed = parseDateValue(value);
	if (!parsed) return fallback;

	if (parsed.kind === "duration") {
		const timePreset = resolvePreset(DEFAULT_DATE_PRESET_NAMES.timeSeconds);
		const formattedDuration = timePreset.formatDuration?.(parsed.durationMs, fallback) ?? fallback;
		if (formattedDuration === fallback) return fallback;

		const [hours = "00", minutes = "00", seconds = "00"] = formattedDuration.split(":");
		return `PT${hours}H${minutes}M${seconds}S`;
	}

	const date = parsed.date;
	return `PT${padDatePart(date.getHours())}H${padDatePart(date.getMinutes())}M${padDatePart(date.getSeconds())}S`;
}
