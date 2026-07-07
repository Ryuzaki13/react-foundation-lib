import type { NumberFormatCompactOptions, NumberFormatCompactRoundingMode, NumberFormatCompactUnit, NumberFormatPreset } from "./types";

type PlainNumberFormatter = (value: number, preset: NumberFormatPreset) => string;

type ResolvedCompactNumberOptions = {
	roundingMode: NumberFormatCompactRoundingMode;
	suffixSeparator: string;
	maxDecimals?: number;
	units: readonly NumberFormatCompactUnit[];
};

const DEFAULT_COMPACT_NUMBER_UNITS: readonly NumberFormatCompactUnit[] = [
	{ value: 1_000_000_000_000, suffix: "трлн" },
	{ value: 1_000_000_000, suffix: "млрд" },
	{ value: 1_000_000, suffix: "млн" },
	{ value: 1_000, suffix: "тыс" }
];

const DEFAULT_COMPACT_NUMBER_OPTIONS = {
	minCompactValue: 1_000,
	roundingMode: "trunc",
	suffixSeparator: " "
} satisfies Required<Pick<NumberFormatCompactOptions, "minCompactValue" | "roundingMode" | "suffixSeparator">>;

const DEFAULT_COMPACT_DECIMAL_SEPARATOR = ",";

function applyCompactRounding(value: number, mode: NumberFormatCompactRoundingMode): number {
	switch (mode) {
		case "round":
			return Math.round(value);

		case "floor":
			return Math.floor(value);

		case "ceil":
			return Math.ceil(value);

		case "trunc":
			return Math.trunc(value);
	}
}

function roundCompactValue(value: number, decimals: number, mode: NumberFormatCompactRoundingMode): number {
	if (decimals === 0) return applyCompactRounding(value, mode);

	const factor = 10 ** decimals;
	return applyCompactRounding(value * factor, mode) / factor;
}

function getAutoCompactDecimals(normalizedValue: number): number {
	if (normalizedValue >= 10) return 0;

	return 1;
}

function getEffectiveDecimals(value: number, maxDecimals: number): number {
	if (maxDecimals === 0) return 0;

	const fixed = value.toFixed(maxDecimals);
	const decimalSeparatorIndex = fixed.indexOf(".");

	if (decimalSeparatorIndex === -1) return 0;

	const fraction = fixed.slice(decimalSeparatorIndex + 1).replace(/0+$/, "");

	return fraction.length;
}

function getCompactUnitIndex(value: number, units: readonly NumberFormatCompactUnit[]): number {
	return units.findIndex((unit) => value >= unit.value);
}

function createPlainCompactPreset(preset: NumberFormatPreset, decimals: number): NumberFormatPreset {
	return {
		name: preset.name,
		decimals,
		decimalSeparator: decimals > 0 ? preset.decimalSeparator || DEFAULT_COMPACT_DECIMAL_SEPARATOR : preset.decimalSeparator,
		grouping: preset.grouping,
		groupingSeparator: preset.groupingSeparator,
		groupingSize: preset.groupingSize
	};
}

function formatCompactValueByUnit(
	absValue: number,
	unitIndex: number,
	options: ResolvedCompactNumberOptions,
	preset: NumberFormatPreset,
	formatPlainNumber: PlainNumberFormatter
): string {
	const unit = options.units[unitIndex];
	if (!unit) return formatPlainNumber(absValue, preset);

	const normalizedValue = absValue / unit.value;
	const maxDecimals = options.maxDecimals ?? getAutoCompactDecimals(normalizedValue);
	const roundedValue = roundCompactValue(normalizedValue, maxDecimals, options.roundingMode);

	// Защита от результата вида "1000 тыс": переходим на следующую единицу.
	if (roundedValue >= 1000 && unitIndex > 0) {
		return formatCompactValueByUnit(absValue, unitIndex - 1, options, preset, formatPlainNumber);
	}

	const decimals = getEffectiveDecimals(roundedValue, maxDecimals);
	const compactPreset = createPlainCompactPreset(preset, decimals);

	return `${formatPlainNumber(roundedValue, compactPreset)}${options.suffixSeparator}${unit.suffix}`;
}

export function formatCompactNumberValue(args: {
	value: number;
	preset: NumberFormatPreset;
	options: NumberFormatCompactOptions;
	formatPlainNumber: PlainNumberFormatter;
}): string {
	const {
		minCompactValue = DEFAULT_COMPACT_NUMBER_OPTIONS.minCompactValue,
		roundingMode = DEFAULT_COMPACT_NUMBER_OPTIONS.roundingMode,
		suffixSeparator = DEFAULT_COMPACT_NUMBER_OPTIONS.suffixSeparator,
		maxDecimals,
		units = DEFAULT_COMPACT_NUMBER_UNITS
	} = args.options;

	const absValue = Math.abs(args.value);

	if (absValue < minCompactValue) {
		return args.formatPlainNumber(args.value, args.preset);
	}

	const unitIndex = getCompactUnitIndex(absValue, units);

	if (unitIndex === -1) {
		return args.formatPlainNumber(args.value, args.preset);
	}

	const sign = args.value < 0 ? "-" : "";

	return `${sign}${formatCompactValueByUnit(
		absValue,
		unitIndex,
		{
			roundingMode,
			suffixSeparator,
			maxDecimals,
			units
		},
		args.preset,
		args.formatPlainNumber
	)}`;
}
