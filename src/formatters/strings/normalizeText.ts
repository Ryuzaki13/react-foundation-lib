export function normalizeText(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

export function normalizeTextWithFallback(value: unknown, fallback = "") {
	return normalizeText(value) ?? fallback;
}

export function normalizeRequiredText(value: unknown) {
	return normalizeTextWithFallback(value);
}

export function normalizeTextToLower(value: unknown): string {
	const normalized = normalizeText(value);
	return normalized ? normalized.toLowerCase() : "";
}

export function toSafeString(value: unknown): string {
	return value == null ? "" : String(value);
}

const STRING_SPACES_PATTERN = /[\s\u00a0\u202f]+/gu;

/**
 * Нормализует пользовательский текст: убирает пробелы по краям
 * и сворачивает любые подряд идущие пробельные символы в один обычный пробел.
 */
export function normalizeTextSpaces(value: unknown): string {
	return normalizeRequiredText(value).replace(STRING_SPACES_PATTERN, " ");
}
