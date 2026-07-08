import { formatCompactNumberValue } from "./compact";
import { isZeroValue } from "./isZeroValue";
import { DEFAULT_NUMBER_PRESET_NAMES, NUMBER_FORMAT_DEFAULTS, resolveNumberPreset } from "./presets";

import type { NumberFormatPreset } from "./types";

/** Кеш Intl.NumberFormat по ключу "decimals:grouping" */
const cache = new Map<string, Intl.NumberFormat>();

/** Усечение дробной части без округления: 1234.789 → 1234.7 (при decimals=1) */
export function truncateNumber(num: number, decimals: number): number {
	if (decimals === 0) return Math.trunc(num);
	const factor = 10 ** decimals;
	return Math.trunc(num * factor) / factor;
}

function getFormatter(decimals: number, grouping: boolean): Intl.NumberFormat {
	const key = `${decimals}:${grouping ? 1 : 0}`;
	let fmt = cache.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat("ru-RU", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
			useGrouping: grouping
		});
		cache.set(key, fmt);
	}
	return fmt;
}

/** Разделители совпадают с ru-RU — можно использовать format() напрямую */
function isStandard(p: NumberFormatPreset): boolean {
	return (
		p.groupingSize === 3 &&
		(p.groupingSeparator === NUMBER_FORMAT_DEFAULTS.groupingSeparator || !p.grouping) &&
		(p.decimalSeparator === "," || p.decimals === 0)
	);
}

/**
 * Быстрый путь (99% вызовов): format() напрямую, без постобработки.
 * ru-RU уже даёт неразрывный пробел и запятую — именно то, что нужно.
 */
function formatStandard(num: number, decimals: number, grouping: boolean): string {
	return getFormatter(decimals, grouping).format(num);
}

/** Кастомные разделители: formatToParts() с подстановкой */
function formatCustomSeparator(num: number, preset: NumberFormatPreset): string {
	const parts = getFormatter(preset.decimals, preset.grouping).formatToParts(num);
	let result = "";
	for (const p of parts) {
		if (p.type === "group") result += preset.groupingSeparator;
		else if (p.type === "decimal") result += preset.decimalSeparator;
		else result += p.value;
	}
	return result;
}

/** Нестандартный размер группы: Intl для округления, ручная группировка */
function formatManualGroup(num: number, preset: NumberFormatPreset): string {
	const raw = getFormatter(preset.decimals, false).format(num);

	// ru-RU без группировки: "1234567,89" — запятая как десятичный разделитель
	const sep = raw.indexOf(",");
	const intPart = sep === -1 ? raw : raw.slice(0, sep);
	const fracPart = sep === -1 ? null : raw.slice(sep + 1);

	const neg = intPart.startsWith("-");
	const abs = neg ? intPart.slice(1) : intPart;

	const size = preset.groupingSize;
	const groups: string[] = [];
	for (let i = abs.length; i > 0; i -= size) {
		groups.unshift(abs.slice(Math.max(0, i - size), i));
	}

	let result = (neg ? "-" : "") + groups.join(preset.groupingSeparator);
	if (fracPart !== null) result += preset.decimalSeparator + fracPart;
	return result;
}

function formatPlainNumber(num: number, preset: NumberFormatPreset): string {
	// 99% — стандартный ru-RU формат, format() без постобработки
	if (isStandard(preset)) return formatStandard(num, preset.decimals, preset.grouping);

	// Стандартный размер группы (3), но кастомные разделители
	if (preset.groupingSize === 3 || !preset.grouping) return formatCustomSeparator(num, preset);

	// Нестандартный размер группы
	return formatManualGroup(num, preset);
}

/**
 * Форматирование числа по предустановке.
 * Оптимизировано для 500+ вызовов: кеш Intl.NumberFormat + быстрый путь через format().
 *
 * Не использовать напрямую! Использовать `formatNumberAs*`
 */
export function formatNumber(value: unknown, presetOrName: string | NumberFormatPreset): string {
	if (typeof value === "string" && value.trim() === "") return "0";

	const num = Number(value);
	if (!Number.isFinite(num)) return "0";

	const preset = resolveNumberPreset(presetOrName);

	// Усечение без округления — Intl занимается только группировкой и разделителями
	// const truncated = truncateNumber(num, preset.decimals);
	// NOTE: 30.04.2026 выяснилось, что всё таки должно быть именно округление, а не усечение

	if (preset.compact) {
		return formatCompactNumberValue({
			value: num,
			preset,
			options: preset.compact,
			formatPlainNumber
		});
	}

	return formatPlainNumber(num, preset);
}

/**
 * Форматирование значения пресетом `integer` (0 знаков после запятой)
 */
export function formatNumberAsInteger(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.integer);
}

/**
 * Форматирование значения пресетом `currency` (0 знаков после запятой)
 */
export function formatNumberAsCurrency(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.currency);
}

/**
 * Форматирование значения пресетом `decimal` (1 знак после запятой)
 */
export function formatNumberAsDecimal(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.decimal);
}

/**
 * Форматирование значения пресетом `decimal-2` (2 знака после запятой)
 */
export function formatNumberAsDecimal2(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.decimal2);
}

/**
 * Форматирование значения пресетом `decimal-3` (3 знака после запятой)
 */
export function formatNumberAsDecimal3(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.decimal3);
}

/**
 * Форматирование значения пресетом `percent` (2 знака после запятой)
 */
export function formatNumberAsPercent(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.percent);
}

/**
 * Форматирование значения пресетом `price` (0 знаков после запятой)
 */
export function formatNumberAsPrice(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.price);
}

/**
 * Форматирование значения пресетом `tonnage` (1 знак после запятой)
 */
export function formatNumberAsTonnage(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.tonnage);
}

/**
 * Форматирование значения пресетом `integer` (0 знаков после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsIntegerOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.integer);
}

/**
 * Форматирование значения пресетом `currency` (0 знаков после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsCurrencyOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.currency);
}

/**
 * Форматирование значения пресетом `decimal` (1 знак после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsDecimalOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.decimal);
}

/**
 * Форматирование значения пресетом `decimal-2` (2 знака после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsDecimal2OrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.decimal2);
}

/**
 * Форматирование значения пресетом `decimal-3` (3 знака после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsDecimal3OrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.decimal3);
}

/**
 * Форматирование значения пресетом `percent` (2 знака после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsPercentOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.percent);
}

/**
 * Форматирование значения пресетом `price` (0 знаков после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsPriceOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.price);
}

/**
 * Форматирование значения пресетом `tonnage` (1 знак после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsTonnageOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.tonnage);
}

/** Очистить кеш Intl.NumberFormat */
export function clearFormatCache(): void {
	cache.clear();
}
