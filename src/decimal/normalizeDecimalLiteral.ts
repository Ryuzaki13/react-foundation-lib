import { normalizeDecimal } from "./normalizeDecimal";
import { resolveDecimalMaxLength } from "./resolveDecimalMaxLength";

import type { DecimalOptions } from "./types";

/**
 * Сохраняет все цифры внешнего числового литерала, включая научную запись JSON.
 * На вход передаётся исходная лексема parser, а не уже округлённый number.
 * Локализованные разделители и пробелы остаются ответственностью формы ввода.
 */
export function normalizeDecimalLiteral(value: string, options?: DecimalOptions): string {
	const maxLength = resolveDecimalMaxLength(options);
	if (typeof value !== "string" || value.length > maxLength) {
		throw new TypeError("Ожидался ограниченный десятичный числовой литерал.");
	}
	const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?(?![\s\S])/u.exec(value);
	if (!match) throw new TypeError("Ожидался конечный десятичный числовой литерал.");
	const [, sign, integer, fraction = "", exponent] = match;
	if (exponent === undefined) return normalizeDecimal(value, options);

	const digits = integer + fraction;
	const significant = digits.replace(/^0+/u, "");
	if (!significant) return "0";
	const coefficient = significant.replace(/0+$/u, "");
	// Number описывает только ограниченный сдвиг точки, никогда значение числа.
	const shift = Number(exponent);
	if (!Number.isSafeInteger(shift)) throw new RangeError("Экспонента превышает допустимую длину результата.");
	const point = integer.length + shift - (digits.length - significant.length);
	const length =
		sign.length +
		(point <= 0 ? 2 - point + coefficient.length : Math.max(point, coefficient.length + (point < coefficient.length ? 1 : 0)));
	if (length > maxLength) throw new RangeError("Десятичный результат превышает допустимую длину.");

	if (point <= 0) return `${sign}0.${"0".repeat(-point)}${coefficient}`;
	if (point >= coefficient.length) return sign + coefficient + "0".repeat(point - coefficient.length);
	return `${sign}${coefficient.slice(0, point)}.${coefficient.slice(point)}`;
}
