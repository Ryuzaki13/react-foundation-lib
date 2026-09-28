import { alignDecimalParts } from "./alignDecimalParts";
import { readDecimalParts } from "./readDecimalParts";

import type { DecimalComparison, DecimalOptions, DecimalRatio } from "./types";

/** Сравнивает отношения перекрёстным умножением. Периодическая дробь не делится и не округляется. */
export function compareDecimalRatios(left: DecimalRatio, right: DecimalRatio, options?: DecimalOptions): DecimalComparison {
	const leftNumerator = readDecimalParts(left.numerator, options);
	const leftDenominator = readDecimalParts(left.denominator, options);
	const rightNumerator = readDecimalParts(right.numerator, options);
	const rightDenominator = readDecimalParts(right.denominator, options);

	if (leftDenominator.coefficient <= 0n || rightDenominator.coefficient <= 0n) {
		throw new RangeError("Знаменатель отношения должен быть строго положительным.");
	}

	// Произведения приватные: их разрядность ограничена четырьмя проверенными операндами,
	// но может превышать длину сериализуемого числа. Проверять их как внешний результат нельзя.
	const aligned = alignDecimalParts(
		{ coefficient: leftNumerator.coefficient * rightDenominator.coefficient, scale: leftNumerator.scale + rightDenominator.scale },
		{ coefficient: rightNumerator.coefficient * leftDenominator.coefficient, scale: rightNumerator.scale + leftDenominator.scale }
	);

	return aligned.left < aligned.right ? -1 : aligned.left > aligned.right ? 1 : 0;
}
