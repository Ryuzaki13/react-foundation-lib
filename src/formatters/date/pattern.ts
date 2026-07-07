import type { DateFormatPrecision } from "./types";

/**
 * Токены календарной даты, поддерживаемые ручными шаблонами форматирования.
 */
export const DATE_PATTERN_DATE_TOKENS = Object.freeze(["dd", "MM", "yyyy", "yy"] as const);

/**
 * Токены времени, поддерживаемые ручными шаблонами форматирования.
 */
export const DATE_PATTERN_TIME_TOKENS = Object.freeze(["HH", "mm", "ss"] as const);

/**
 * Все токены ручного шаблона даты/времени.
 */
export const DATE_PATTERN_TOKENS = Object.freeze([...DATE_PATTERN_DATE_TOKENS, ...DATE_PATTERN_TIME_TOKENS] as const);

/**
 * Регулярное выражение для поиска токенов ручного шаблона.
 */
export const DATE_PATTERN_TOKEN_RE = /(yyyy|yy|MM|dd|HH|mm|ss)/g;

const DATE_PATTERN_TOKEN_SET = new Set<string>(DATE_PATTERN_TOKENS);
const DATE_PATTERN_PRECISION_TOKENS: Readonly<Record<DateFormatPrecision, ReadonlySet<string>>> = Object.freeze({
	day: new Set(DATE_PATTERN_TOKENS),
	month: new Set(["MM", "yyyy", "yy"]),
	year: new Set(["yyyy", "yy"])
});

/**
 * Проверяет, что сегмент шаблона является поддерживаемым токеном даты/времени.
 */
export function isDatePatternToken(value: string): boolean {
	return DATE_PATTERN_TOKEN_SET.has(value);
}

/**
 * Проверяет, что шаблон содержит хотя бы один токен из списка.
 */
export function containsDatePatternToken(pattern: string, tokens: readonly string[]): boolean {
	return tokens.some((token) => pattern.includes(token));
}

/**
 * Проверяет, похожа ли строка на ручной шаблон даты.
 */
export function hasDatePatternTokens(pattern: string): boolean {
	DATE_PATTERN_TOKEN_RE.lastIndex = 0;
	return DATE_PATTERN_TOKEN_RE.test(pattern);
}

/**
 * Возвращает токены, допустимые для выбранной точности календарной даты.
 */
export function getDatePatternPrecisionTokens(precision: DateFormatPrecision): ReadonlySet<string> {
	return DATE_PATTERN_PRECISION_TOKENS[precision];
}

/**
 * Удаляет из ручного шаблона части даты, которые ниже выбранной точности.
 */
export function resolveDatePatternPrecision(pattern: string, precision: DateFormatPrecision): string {
	if (precision === "day") return pattern;

	const allowedTokens = getDatePatternPrecisionTokens(precision);
	const resultSegments: string[] = [];
	let pendingLiteral = "";
	let hasKeptToken = false;
	let keptTokenCount = 0;
	let cursor = 0;
	let match: RegExpExecArray | null;

	DATE_PATTERN_TOKEN_RE.lastIndex = 0;
	while ((match = DATE_PATTERN_TOKEN_RE.exec(pattern))) {
		const literal = pattern.slice(cursor, match.index);
		const token = match[0];

		if (hasKeptToken) pendingLiteral += literal;

		if (allowedTokens.has(token)) {
			if (hasKeptToken) resultSegments.push(pendingLiteral);
			resultSegments.push(token);
			pendingLiteral = "";
			hasKeptToken = true;
			keptTokenCount += 1;
		}

		cursor = match.index + token.length;
	}

	if (keptTokenCount === 0) return pattern;
	return resultSegments.join("");
}
