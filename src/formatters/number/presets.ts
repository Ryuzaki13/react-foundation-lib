import type { NumberFormatPreset, NumberFormatPresetConfig } from "./types";

/** Символ группировки из ru-RU (U+00A0 или U+202F в зависимости от среды) */
const ruGroupChar = new Intl.NumberFormat("ru-RU").formatToParts(1000).find((p) => p.type === "group")?.value ?? "\u00A0";

/** Значения по умолчанию — совпадают с ru-RU форматированием */
export const NUMBER_FORMAT_DEFAULTS: Omit<NumberFormatPreset, "name"> = {
	decimals: 1,
	decimalSeparator: ",",
	grouping: true,
	groupingSeparator: ruGroupChar,
	groupingSize: 3
};

export const DEFAULT_NUMBER_PRESET_NAMES = Object.freeze({
	integer: "integer",
	decimal: "decimal",
	decimal2: "decimal-2",
	decimal3: "decimal-3",
	currency: "currency",
	price: "price",
	percent: "percent",
	tonnage: "tonnage",
	compactCurrency: "compact-currency",
	compactCurrencyRound: "compact-currency-round",
	compactPercent: "compact-percent",
	compactPercentRound: "compact-percent-round",
	compactTonnage: "compact-tonnage",
	compactTonnageRound: "compact-tonnage-round"
});

/**
 * Типовые предустановки числового форматирования.
 *
 * Compact-пресеты без суффикса сохраняют консервативное усечение, а парные
 * `*-round` дают явный математический режим без runtime-переопределения пресета.
 * Недостающие поля каждой предустановки заполняются из `NUMBER_FORMAT_DEFAULTS`.
 */
const BUILTIN: NumberFormatPresetConfig[] = [
	{ name: "integer", decimals: 0, decimalSeparator: "" },
	{ name: "decimal" },
	{ name: "decimal-2", decimals: 2 },
	{ name: "decimal-3", decimals: 3 },
	{ name: "currency", decimals: 0, decimalSeparator: "" },
	{ name: "price", decimals: 0, decimalSeparator: "" },
	{ name: "percent", decimals: 2 },
	{ name: "tonnage" },
	{ name: "compact-currency", decimals: 0, decimalSeparator: "", compact: {} },
	{ name: "compact-currency-round", decimals: 0, decimalSeparator: "", compact: { roundingMode: "round" } },
	{ name: "compact-percent", decimals: 2, compact: { maxDecimals: 2 } },
	{ name: "compact-percent-round", decimals: 2, compact: { maxDecimals: 2, roundingMode: "round" } },
	{ name: "compact-tonnage", compact: { maxDecimals: 1 } },
	{ name: "compact-tonnage-round", compact: { maxDecimals: 1, roundingMode: "round" } }
];

const registry = new Map<string, NumberFormatPreset>();

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
	registry.set(preset.name, preset);
	return preset;
}

/** Сбросить реестр к начальному состоянию (только типовые предустановки) */
export function resetNumberPresets(): void {
	registry.clear();
	init();
}

export function resolveNumberPreset(presetOrName: string | NumberFormatPreset): NumberFormatPreset {
	if (typeof presetOrName !== "string") return presetOrName;

	const found = getNumberPreset(presetOrName);
	if (!found) throw new Error(`Предустановка "${presetOrName}" не найдена`);

	return found;
}
