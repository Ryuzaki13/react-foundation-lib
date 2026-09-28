import type { DecimalParts } from "./types";

/** Выравнивает только разрядность ограниченных операндов; глобального кеша степеней нет. */
export function alignDecimalParts(left: DecimalParts, right: DecimalParts): Readonly<{ left: bigint; right: bigint; scale: number }> {
	const scale = Math.max(left.scale, right.scale);

	return {
		left: left.coefficient * 10n ** BigInt(scale - left.scale),
		right: right.coefficient * 10n ** BigInt(scale - right.scale),
		scale
	};
}
