import { alignDecimalParts } from "./alignDecimalParts";
import { readDecimalParts } from "./readDecimalParts";
import { writeDecimalParts } from "./writeDecimalParts";

import type { DecimalOptions } from "./types";

/** Складывает значения без IEEE 754 и возвращает каноническую строку. */
export function addDecimals(left: string, right: string, options?: DecimalOptions): string {
	const aligned = alignDecimalParts(readDecimalParts(left, options), readDecimalParts(right, options));

	return writeDecimalParts({ coefficient: aligned.left + aligned.right, scale: aligned.scale }, options);
}
