/**
 * Преобразует произвольный тег в однословный hashtag для отображения.
 * Используется только на presentation-слое, не для хранения исходного значения.
 */
export function formatTagAsHashtag(value: string): string {
	const normalized = value.trim().replace(/^#+/, "").replace(/\s+/g, "");

	return normalized ? `#${normalized}` : "#";
}
