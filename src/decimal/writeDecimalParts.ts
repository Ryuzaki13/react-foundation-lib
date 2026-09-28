import { resolveDecimalMaxLength } from "./resolveDecimalMaxLength";

import type { DecimalOptions, DecimalParts } from "./types";

/** Канонизирует результат после точного вычисления и отклоняет overflow вместо округления. */
export function writeDecimalParts(parts: DecimalParts, options?: DecimalOptions): string {
	const maxLength = resolveDecimalMaxLength(options);

	if (parts.coefficient === 0n) {
		return "0";
	}

	const negative = parts.coefficient < 0n;
	const magnitude = negative ? -parts.coefficient : parts.coefficient;
	const digits = magnitude.toString().padStart(parts.scale + 1, "0");
	const point = digits.length - parts.scale;
	const unsigned = parts.scale === 0 ? digits : `${digits.slice(0, point)}.${digits.slice(point)}`.replace(/\.?0+$/u, "");
	const result = negative ? `-${unsigned}` : unsigned;

	if (result.length > maxLength) {
		throw new RangeError("Результат десятичного вычисления превысил допустимую длину.");
	}

	return result;
}
