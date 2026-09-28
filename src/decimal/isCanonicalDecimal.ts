import { resolveDecimalMaxLength } from "./resolveDecimalMaxLength";

import type { DecimalOptions } from "./types";

/** Runtime-проверка для внешних данных без преобразования значащих цифр в number. */
export function isCanonicalDecimal(value: unknown, options?: DecimalOptions): value is string {
	const maxLength = resolveDecimalMaxLength(options);

	return (
		typeof value === "string" && value.length <= maxLength && /^(?:0|-?(?:[1-9]\d*(?:\.\d*[1-9])?|0\.\d*[1-9]))(?![\s\S])/u.test(value)
	);
}
