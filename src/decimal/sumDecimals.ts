import { addDecimals } from "./addDecimals";
import { resolveDecimalMaxLength } from "./resolveDecimalMaxLength";

import type { DecimalOptions } from "./types";

/** Читает iterable один раз и проверяет каждый промежуточный итог; пустой набор даёт ноль. */
export function sumDecimals(values: Iterable<string>, options?: DecimalOptions): string {
	resolveDecimalMaxLength(options);
	let total = "0";

	for (const value of values) {
		total = addDecimals(total, value, options);
	}

	return total;
}
