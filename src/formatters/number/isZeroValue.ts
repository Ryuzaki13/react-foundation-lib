import { toFiniteNumber } from "./parseNumber";

/**
 * Проверяет, что значение семантически эквивалентно нулю и может быть скрыто как пустое.
 */
export function isZeroValue(value: unknown): boolean {
	const v = toFiniteNumber(value);

	if (typeof v === "number") {
		return v === 0;
	}

	if (typeof v === "bigint") {
		return v === 0n;
	}

	return false;
}
