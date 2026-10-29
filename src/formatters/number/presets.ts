import {
	STANDARD_NUMBER_GROUP_SIZE,
	NUMBER_FORMAT_LOCALE,
	INTL_NUMBER_PART_GROUP,
	COMPACT_ROUNDING_MODE_ROUND,
	NUMBER_FORMAT_STYLE_PERCENT
} from "./numberFormatConstants";
import {
	NUMBER_PRESET_NAME_INTEGER,
	NUMBER_PRESET_NAME_DECIMAL,
	NUMBER_PRESET_NAME_DECIMAL2,
	NUMBER_PRESET_NAME_DECIMAL3,
	NUMBER_PRESET_NAME_CURRENCY,
	NUMBER_PRESET_NAME_PRICE,
	NUMBER_PRESET_NAME_PERCENT,
	NUMBER_PRESET_NAME_RATIO_PERCENT,
	NUMBER_PRESET_NAME_TONNAGE,
	NUMBER_PRESET_NAME_COMPACT_CURRENCY,
	NUMBER_PRESET_NAME_COMPACT_CURRENCY_ROUND,
	NUMBER_PRESET_NAME_COMPACT_PERCENT,
	NUMBER_PRESET_NAME_COMPACT_PERCENT_ROUND,
	NUMBER_PRESET_NAME_COMPACT_TONNAGE,
	NUMBER_PRESET_NAME_COMPACT_TONNAGE_ROUND
} from "./numberPresetNameConstants";
import { type NumberFormatPreset, type NumberFormatPresetConfig } from "./types";

/** Четырёхзначная проба извлекает групповой разделитель выбранной локали. */
const GROUP_SEPARATOR_PROBE_VALUE = 1_000;

/** Символ группировки из ru-RU (U+00A0 или U+202F в зависимости от среды) */
const ruGroupChar =
	new Intl.NumberFormat(NUMBER_FORMAT_LOCALE).formatToParts(GROUP_SEPARATOR_PROBE_VALUE).find((p) => p.type === INTL_NUMBER_PART_GROUP)
		?.value ?? "\u00A0";

/** Значения по умолчанию — совпадают с ru-RU форматированием */
export const NUMBER_FORMAT_DEFAULTS: Omit<NumberFormatPreset, "name"> = {
	decimals: 1,
	decimalSeparator: ",",
	grouping: true,
	groupingSeparator: ruGroupChar,
	groupingSize: STANDARD_NUMBER_GROUP_SIZE
};

export const DEFAULT_NUMBER_PRESET_NAMES = Object.freeze({
	integer: NUMBER_PRESET_NAME_INTEGER,
	decimal: NUMBER_PRESET_NAME_DECIMAL,
	decimal2: NUMBER_PRESET_NAME_DECIMAL2,
	decimal3: NUMBER_PRESET_NAME_DECIMAL3,
	currency: NUMBER_PRESET_NAME_CURRENCY,
	price: NUMBER_PRESET_NAME_PRICE,
	percent: NUMBER_PRESET_NAME_PERCENT,
	ratioPercent: NUMBER_PRESET_NAME_RATIO_PERCENT,
	tonnage: NUMBER_PRESET_NAME_TONNAGE,
	compactCurrency: NUMBER_PRESET_NAME_COMPACT_CURRENCY,
	compactCurrencyRound: NUMBER_PRESET_NAME_COMPACT_CURRENCY_ROUND,
	compactPercent: NUMBER_PRESET_NAME_COMPACT_PERCENT,
	compactPercentRound: NUMBER_PRESET_NAME_COMPACT_PERCENT_ROUND,
	compactTonnage: NUMBER_PRESET_NAME_COMPACT_TONNAGE,
	compactTonnageRound: NUMBER_PRESET_NAME_COMPACT_TONNAGE_ROUND
});

/**
 * Типовые предустановки числового форматирования.
 *
 * Compact-пресеты без суффикса сохраняют консервативное усечение, а парные
 * `*-round` дают явный математический режим без runtime-переопределения пресета.
 * Недостающие поля каждой предустановки заполняются из `NUMBER_FORMAT_DEFAULTS`.
 */
const BUILTIN: NumberFormatPresetConfig[] = [
	{ name: NUMBER_PRESET_NAME_INTEGER, decimals: 0, decimalSeparator: "" },
	{ name: NUMBER_PRESET_NAME_DECIMAL },
	{ name: NUMBER_PRESET_NAME_DECIMAL2, decimals: 2 },
	{ name: NUMBER_PRESET_NAME_DECIMAL3, decimals: 3 },
	{ name: NUMBER_PRESET_NAME_CURRENCY, decimals: 0, decimalSeparator: "" },
	{ name: NUMBER_PRESET_NAME_PRICE, decimals: 0, decimalSeparator: "" },
	{ name: NUMBER_PRESET_NAME_PERCENT, decimals: 2 },
	{ name: NUMBER_PRESET_NAME_RATIO_PERCENT, decimals: 2, style: NUMBER_FORMAT_STYLE_PERCENT },
	{ name: NUMBER_PRESET_NAME_TONNAGE },
	{ name: NUMBER_PRESET_NAME_COMPACT_CURRENCY, decimals: 0, decimalSeparator: "", compact: {} },
	{
		name: NUMBER_PRESET_NAME_COMPACT_CURRENCY_ROUND,
		decimals: 0,
		decimalSeparator: "",
		compact: { roundingMode: COMPACT_ROUNDING_MODE_ROUND }
	},
	{ name: NUMBER_PRESET_NAME_COMPACT_PERCENT, decimals: 2, compact: { maxDecimals: 2 } },
	{
		name: NUMBER_PRESET_NAME_COMPACT_PERCENT_ROUND,
		decimals: 2,
		compact: { maxDecimals: 2, roundingMode: COMPACT_ROUNDING_MODE_ROUND }
	},
	{ name: NUMBER_PRESET_NAME_COMPACT_TONNAGE, compact: { maxDecimals: 1 } },
	{ name: NUMBER_PRESET_NAME_COMPACT_TONNAGE_ROUND, compact: { maxDecimals: 1, roundingMode: COMPACT_ROUNDING_MODE_ROUND } }
];

const registry = new Map<string, NumberFormatPreset>();

/** Compact использует собственный масштаб; процентный style требует отдельного однозначного представления доли. */
function validateNumberPresetStyle(preset: NumberFormatPreset): void {
	if (preset.style === NUMBER_FORMAT_STYLE_PERCENT && preset.compact !== undefined) {
		throw new Error("Процентный style предустановки не поддерживает compact.");
	}
}

function init(): void {
	for (const cfg of BUILTIN) {
		registry.set(cfg.name, { ...NUMBER_FORMAT_DEFAULTS, ...cfg });
	}
}

init();

export function getNumberPreset(name: string): NumberFormatPreset | undefined {
	return registry.get(name);
}

export function getNumberPresetNames(): string[] {
	return Array.from(registry.keys());
}

/** Зарегистрировать или перезаписать предустановку. Недостающие поля берутся из FORMAT_DEFAULTS. */
export function registerNumberPreset(config: NumberFormatPresetConfig): NumberFormatPreset {
	const preset: NumberFormatPreset = { ...NUMBER_FORMAT_DEFAULTS, ...config };

	validateNumberPresetStyle(preset);

	registry.set(preset.name, preset);
	return preset;
}

/** Сбросить реестр к начальному состоянию (только типовые предустановки) */
export function resetNumberPresets(): void {
	registry.clear();
	init();
}

export function resolveNumberPreset(presetOrName: string | NumberFormatPreset): NumberFormatPreset {
	if (typeof presetOrName !== "string") {
		validateNumberPresetStyle(presetOrName);

		return presetOrName;
	}

	const found = getNumberPreset(presetOrName);
	if (!found) throw new Error(`Предустановка "${presetOrName}" не найдена`);

	validateNumberPresetStyle(found);

	return found;
}
