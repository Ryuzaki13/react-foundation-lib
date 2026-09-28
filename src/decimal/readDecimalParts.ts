import { isCanonicalDecimal } from "./isCanonicalDecimal";

import type { DecimalOptions, DecimalParts } from "./types";

/** Арифметика принимает только канонические строки; нормализация принадлежит входной границе. */
export function readDecimalParts(value: string, options?: DecimalOptions): DecimalParts {
	if (!isCanonicalDecimal(value, options)) {
		throw new TypeError("Ожидалась каноническая десятичная строка в пределах допустимой длины.");
	}

	const point = value.indexOf(".");

	return {
		coefficient: BigInt(value.replace(".", "")),
		scale: point === -1 ? 0 : value.length - point - 1
	};
}
