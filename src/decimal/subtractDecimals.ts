import { alignDecimalParts } from "./alignDecimalParts";
import { readDecimalParts } from "./readDecimalParts";
import { writeDecimalParts } from "./writeDecimalParts";

import type { DecimalOptions } from "./types";

/** Сохраняет знак остатка; предметные ограничения отрицательных значений находятся у consumer. */
export function subtractDecimals(left: string, right: string, options?: DecimalOptions): string {
	const aligned = alignDecimalParts(readDecimalParts(left, options), readDecimalParts(right, options));

	return writeDecimalParts({ coefficient: aligned.left - aligned.right, scale: aligned.scale }, options);
}
