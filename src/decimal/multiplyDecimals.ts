import { readDecimalParts } from "./readDecimalParts";
import { writeDecimalParts } from "./writeDecimalParts";

import type { DecimalOptions } from "./types";

/** Точное умножение не устанавливает фиксированную сетку дробности. */
export function multiplyDecimals(left: string, right: string, options?: DecimalOptions): string {
	const first = readDecimalParts(left, options);
	const second = readDecimalParts(right, options);

	return writeDecimalParts({ coefficient: first.coefficient * second.coefficient, scale: first.scale + second.scale }, options);
}
