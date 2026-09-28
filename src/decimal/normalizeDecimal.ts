import { resolveDecimalMaxLength } from "./resolveDecimalMaxLength";

import type { DecimalOptions } from "./types";

/** Убирает лишние нули. Пробелы, запятую, плюс и экспоненту обрабатывает владелец внешнего формата. */
export function normalizeDecimal(value: string, options?: DecimalOptions): string {
	const maxLength = resolveDecimalMaxLength(options);

	if (typeof value !== "string" || value.length > maxLength || !/^-?\d+(?:\.\d+)?(?![\s\S])/u.test(value)) {
		throw new TypeError("Ожидалась ограниченная конечная десятичная строка с точкой.");
	}

	const negative = value.startsWith("-");
	const unsigned = negative ? value.slice(1) : value;
	const [integer, fraction = ""] = unsigned.split(".");
	const whole = integer.replace(/^0+(?=\d)/u, "");
	const fractional = fraction.replace(/0+$/u, "");
	const magnitude = fractional ? `${whole}.${fractional}` : whole;

	return negative && magnitude !== "0" ? `-${magnitude}` : magnitude;
}
