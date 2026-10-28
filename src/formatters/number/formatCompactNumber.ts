import { formatNumber } from "./formatNumber";
import { FORMATTED_NUMBER_ZERO, COMPACT_ROUNDING_MODE_TRUNC } from "./numberFormatConstants";
import { NUMBER_PRESET_NAME_INTEGER, NUMBER_PRESET_NAME_CURRENCY, NUMBER_PRESET_NAME_COMPACT_CURRENCY } from "./numberPresetNameConstants";
import { toFiniteNumber } from "./parseNumber";
import { resolveNumberPreset } from "./presets";
import { type NumberFormatCompactOptions, type NumberFormatPreset } from "./types";

const CHART_AXIS_MIN_COMPACT_VALUE = 10_000;

/**
 * Компактное форматирование числа по предустановке.
 *
 * Примеры:
 * 34 823 -> "34 тыс"
 * 1 022 342 -> "1 млн"
 * 1 534 000 -> "1,5 млн"
 *
 * Для шкал графиков по умолчанию используется усечение, а не округление,
 * чтобы не завышать визуальное значение.
 */
export function formatCompactNumber(
	value: unknown,
	presetOrName: string | NumberFormatPreset = NUMBER_PRESET_NAME_INTEGER,
	options: NumberFormatCompactOptions = {}
): string {
	const num = toFiniteNumber(value);
	if (num === undefined) return FORMATTED_NUMBER_ZERO;

	const preset = resolveNumberPreset(presetOrName);
	const compactPreset: NumberFormatPreset = {
		...preset,
		compact: {
			...preset.compact,
			...options
		}
	};

	return formatNumber(num, compactPreset);
}

/**
 * Компактное форматирование значения пресетом `integer`.
 *
 * Подходит для осей графиков:
 * 34 823 -> "34 тыс"
 * 1 022 342 -> "1 млн"
 */
export function formatNumberAsCompact(value: unknown): string {
	return formatCompactNumber(value, NUMBER_PRESET_NAME_INTEGER);
}

/**
 * Компактное форматирование значения пресетом `currency`.
 *
 * Валютный символ не добавляется — это формат именно для короткой шкалы.
 */
export function formatNumberAsCompactCurrency(value: unknown): string {
	return formatCompactNumber(value, NUMBER_PRESET_NAME_COMPACT_CURRENCY);
}

/**
 * Компактное форматирование для оси графика.
 *
 * Название более предметное, чтобы в chart-коде было понятно назначение.
 */
export function formatNumberAsChartAxis(value: unknown): string {
	return formatCompactNumber(value, NUMBER_PRESET_NAME_INTEGER, {
		minCompactValue: CHART_AXIS_MIN_COMPACT_VALUE,
		roundingMode: COMPACT_ROUNDING_MODE_TRUNC
	});
}

/**
 * Полное форматирование для tooltip графика.
 *
 * На оси: 1 млн
 * В tooltip: 1 022 342
 */
export function formatNumberAsChartTooltip(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_INTEGER);
}

/**
 * Компактное форматирование валюты для оси графика.
 */
export function formatNumberAsCurrencyChartAxis(value: unknown): string {
	return formatCompactNumber(value, NUMBER_PRESET_NAME_COMPACT_CURRENCY);
}

/**
 * Полное форматирование валюты для tooltip графика.
 */
export function formatNumberAsCurrencyChartTooltip(value: unknown): string {
	return formatNumber(value, NUMBER_PRESET_NAME_CURRENCY);
}
