import { addDecimals } from "./addDecimals";
import { CANONICAL_DECIMAL_ZERO } from "./decimalConstants";
import { resolveDecimalMaxLength } from "./resolveDecimalMaxLength";

import type { DecimalOptions } from "./types";

/** Читает iterable один раз и проверяет каждый промежуточный итог; пустой набор даёт ноль. */
export function sumDecimals(values: Iterable<string>, options?: DecimalOptions): string {
	resolveDecimalMaxLength(options);
	let total = CANONICAL_DECIMAL_ZERO;

	for (const value of values) {
		total = addDecimals(total, value, options);
	}

	return total;
}
