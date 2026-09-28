import type { DecimalOptions } from "./types";

/** Проверяет предел до разбора числа и выделения вычислительных буферов. */
export function resolveDecimalMaxLength(options?: DecimalOptions): number {
	const maxLength = options?.maxLength ?? 512;

	if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
		throw new RangeError("Предел длины десятичного значения должен быть положительным безопасным целым числом.");
	}

	return maxLength;
}
