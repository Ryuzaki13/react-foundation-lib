import { normalizeText } from "./normalizeText";

export function truncateText(value: string | null | undefined, maxLength: number) {
	const normalized = normalizeText(value);
	if (!normalized) return undefined;

	return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}
