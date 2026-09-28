import { alignDecimalParts } from "./alignDecimalParts";
import { readDecimalParts } from "./readDecimalParts";

import type { DecimalComparison, DecimalOptions } from "./types";

/** Сравнивает исходные значения, включая разрядность за пределами безопасного number. */
export function compareDecimals(left: string, right: string, options?: DecimalOptions): DecimalComparison {
	const aligned = alignDecimalParts(readDecimalParts(left, options), readDecimalParts(right, options));

	return aligned.left < aligned.right ? -1 : aligned.left > aligned.right ? 1 : 0;
}
