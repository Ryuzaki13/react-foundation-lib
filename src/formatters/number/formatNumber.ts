import { formatCompactNumberValue } from "./compact";
import { isZeroValue } from "./isZeroValue";
import {
	STANDARD_NUMBER_GROUP_SIZE,
	FORMATTED_NUMBER_ZERO,
	NUMBER_FORMAT_LOCALE,
	NUMBER_FORMAT_STYLE_DECIMAL,
	NUMBER_FORMAT_STYLE_PERCENT,
	INTL_NUMBER_PART_GROUP,
	INTL_NUMBER_PART_DECIMAL,
	INTL_NUMBER_PART_PERCENT_SIGN,
	INTL_NUMBER_PART_LITERAL
} from "./numberFormatConstants";
import {
	NUMBER_PRESET_NAME_INTEGER,
	NUMBER_PRESET_NAME_DECIMAL,
	NUMBER_PRESET_NAME_DECIMAL2,
	NUMBER_PRESET_NAME_DECIMAL3,
	NUMBER_PRESET_NAME_CURRENCY,
	NUMBER_PRESET_NAME_PRICE,
	NUMBER_PRESET_NAME_PERCENT,
	NUMBER_PRESET_NAME_TONNAGE
} from "./numberPresetNameConstants";
import { NUMBER_FORMAT_DEFAULTS, resolveNumberPreset } from "./presets";
import { type NumberFormatPreset } from "./types";

/** Style входит в ключ: decimal и доля с одинаковой точностью не разделяют formatter. */
const cache = new Map<string, Intl.NumberFormat>();

/** Усечение дробной части без округления: 1234.789 → 1234.7 (при decimals=1) */
export function truncateNumber(num: number, decimals: number): number {
	if (decimals === 0) return Math.trunc(num);
	const factor = 10 ** decimals;
	return Math.trunc(num * factor) / factor;
}

function getFormatter(
	decimals: number,
	grouping: boolean,
	style: NumberFormatPreset["style"] = NUMBER_FORMAT_STYLE_DECIMAL
): Intl.NumberFormat {
	const key = `${style}:${decimals}:${grouping ? 1 : 0}`;
	let fmt = cache.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat(NUMBER_FORMAT_LOCALE, {
			style,
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
			useGrouping: grouping
		});
		cache.set(key, fmt);
	}
	return fmt;
}

/**
 * Intl масштабирует долю без промежуточного умножения JS-числа, включая Number.MAX_VALUE.
 * Локализованный суффикс убирается из частей: единый знак добавляется после наших разделителей и группировки.
 */
function formatNumberParts(num: number, decimals: number, grouping: boolean, style: NumberFormatPreset["style"]): Intl.NumberFormatPart[] {
	const parts = getFormatter(decimals, grouping, style).formatToParts(num);

	return style === NUMBER_FORMAT_STYLE_PERCENT
		? parts.filter((part) => part.type !== INTL_NUMBER_PART_PERCENT_SIGN && part.type !== INTL_NUMBER_PART_LITERAL)
		: parts;
}

/** Разделители совпадают с ru-RU — можно использовать format() напрямую */
function isStandard(p: NumberFormatPreset): boolean {
	return (
		p.groupingSize === STANDARD_NUMBER_GROUP_SIZE &&
		(p.groupingSeparator === NUMBER_FORMAT_DEFAULTS.groupingSeparator || !p.grouping) &&
		(p.decimalSeparator === "," || p.decimals === 0)
	);
}

/**
 * Быстрый путь (99% вызовов): format() напрямую, без постобработки.
 * ru-RU уже даёт неразрывный пробел и запятую — именно то, что нужно.
 */
function formatStandard(num: number, decimals: number, grouping: boolean, style: NumberFormatPreset["style"]): string {
	if (style === NUMBER_FORMAT_STYLE_PERCENT) {
		return formatNumberParts(num, decimals, grouping, style)
			.map((part) => part.value)
			.join("");
	}

	return getFormatter(decimals, grouping).format(num);
}

/** Кастомные разделители: formatToParts() с подстановкой */
function formatCustomSeparator(num: number, preset: NumberFormatPreset): string {
	const parts = formatNumberParts(num, preset.decimals, preset.grouping, preset.style);
	let result = "";
	for (const p of parts) {
		if (p.type === INTL_NUMBER_PART_GROUP) result += preset.groupingSeparator;
		else if (p.type === INTL_NUMBER_PART_DECIMAL) result += preset.decimalSeparator;
		else result += p.value;
	}
	return result;
}

/** Нестандартный размер группы: Intl для округления, ручная группировка */
function formatManualGroup(num: number, preset: NumberFormatPreset): string {
	const raw = formatStandard(num, preset.decimals, false, preset.style);

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
	if (isStandard(preset)) return formatStandard(num, preset.decimals, preset.grouping, preset.style);

	// Стандартный размер группы (3), но кастомные разделители
	if (preset.groupingSize === STANDARD_NUMBER_GROUP_SIZE || !preset.grouping) return formatCustomSeparator(num, preset);

	// Нестандартный размер группы
	return formatManualGroup(num, preset);
}

/**
 * Форматирование числа по предустановке.
 * Оптимизировано для 500+ вызовов: кеш Intl.NumberFormat + быстрый путь через format().
 *
 * Для именованных и собственных presets используется этот public API; `formatNumberAs*` выбирают готовые имена.
 */
export function formatNumber(value: unknown, presetOrName: string | NumberFormatPreset): string {
	if (typeof value === "string" && value.trim() === "") return FORMATTED_NUMBER_ZERO;

	const num = Number(value);
	if (!Number.isFinite(num)) return FORMATTED_NUMBER_ZERO;

	const preset = resolveNumberPreset(presetOrName);

	if (preset.compact) {
		return formatCompactNumberValue({
			value: num,
			preset,
			options: preset.compact,
			formatPlainNumber
		});
	}

	const formatted = formatPlainNumber(num, preset);

	return preset.style === NUMBER_FORMAT_STYLE_PERCENT ? `${formatted}%` : formatted;
}

/**
 * Форматирование значения пресетом `integer` (0 знаков после запятой)
 */
export function formatNumberAsInteger(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_INTEGER);
}

/**
 * Форматирование значения пресетом `currency` (0 знаков после запятой)
 */
export function formatNumberAsCurrency(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_CURRENCY);
}

/**
 * Форматирование значения пресетом `decimal` (1 знак после запятой)
 */
export function formatNumberAsDecimal(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_DECIMAL);
}

/**
 * Форматирование значения пресетом `decimal-2` (2 знака после запятой)
 */
export function formatNumberAsDecimal2(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_DECIMAL2);
}

/**
 * Форматирование значения пресетом `decimal-3` (3 знака после запятой)
 */
export function formatNumberAsDecimal3(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_DECIMAL3);
}

/**
 * Форматирование значения пресетом `percent` (2 знака после запятой)
 */
export function formatNumberAsPercent(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_PERCENT);
}

/**
 * Форматирование значения пресетом `price` (0 знаков после запятой)
 */
export function formatNumberAsPrice(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_PRICE);
}

/**
 * Форматирование значения пресетом `tonnage` (1 знак после запятой)
 */
export function formatNumberAsTonnage(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_TONNAGE);
}

/**
 * Форматирование значения пресетом `integer` (0 знаков после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsIntegerOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_INTEGER);
}

/**
 * Форматирование значения пресетом `currency` (0 знаков после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsCurrencyOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_CURRENCY);
}

/**
 * Форматирование значения пресетом `decimal` (1 знак после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsDecimalOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_DECIMAL);
}

/**
 * Форматирование значения пресетом `decimal-2` (2 знака после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsDecimal2OrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_DECIMAL2);
}

/**
 * Форматирование значения пресетом `decimal-3` (3 знака после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsDecimal3OrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_DECIMAL3);
}

/**
 * Форматирование значения пресетом `percent` (2 знака после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsPercentOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_PERCENT);
}

/**
 * Форматирование значения пресетом `price` (0 знаков после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsPriceOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_PRICE);
}

/**
 * Форматирование значения пресетом `tonnage` (1 знак после запятой)
 *
 * Проверяет, если значение семантически эквивалентно нулю, то возвращается пустая строка.
 */
export function formatNumberAsTonnageOrEmpty(value: unknown): string {
	if (isZeroValue(value)) return "";
	return formatNumber(value, NUMBER_PRESET_NAME_TONNAGE);
}

/** Очистить кеш Intl.NumberFormat */
export function clearFormatCache(): void {
	cache.clear();
}
