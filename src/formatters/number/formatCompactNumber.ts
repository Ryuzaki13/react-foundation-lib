import { formatNumber } from "./formatNumber";
import { toFiniteNumber } from "./parseNumber";
import { DEFAULT_NUMBER_PRESET_NAMES, resolveNumberPreset } from "./presets";
import { type NumberFormatCompactOptions, type NumberFormatPreset } from "./types";

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
	presetOrName: string | NumberFormatPreset = DEFAULT_NUMBER_PRESET_NAMES.integer,
	options: NumberFormatCompactOptions = {}
): string {
	const num = toFiniteNumber(value);
	if (num === undefined) return "0";

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
	return formatCompactNumber(value, DEFAULT_NUMBER_PRESET_NAMES.integer);
}

/**
 * Компактное форматирование значения пресетом `currency`.
 *
 * Валютный символ не добавляется — это формат именно для короткой шкалы.
 */
export function formatNumberAsCompactCurrency(value: unknown): string {
	return formatCompactNumber(value, DEFAULT_NUMBER_PRESET_NAMES.compactCurrency);
}

/**
 * Компактное форматирование для оси графика.
 *
 * Название более предметное, чтобы в chart-коде было понятно назначение.
 */
export function formatNumberAsChartAxis(value: unknown): string {
	return formatCompactNumber(value, DEFAULT_NUMBER_PRESET_NAMES.integer, {
		minCompactValue: 10_000,
		roundingMode: "trunc"
	});
}

/**
 * Полное форматирование для tooltip графика.
 *
 * На оси: 1 млн
 * В tooltip: 1 022 342
 */
export function formatNumberAsChartTooltip(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.integer);
}

/**
 * Компактное форматирование валюты для оси графика.
 */
export function formatNumberAsCurrencyChartAxis(value: unknown): string {
	return formatCompactNumber(value, DEFAULT_NUMBER_PRESET_NAMES.compactCurrency);
}

/**
 * Полное форматирование валюты для tooltip графика.
 */
export function formatNumberAsCurrencyChartTooltip(value: unknown): string {
	return formatNumber(value, DEFAULT_NUMBER_PRESET_NAMES.currency);
}
