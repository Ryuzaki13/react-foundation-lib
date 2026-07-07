/**
 * SAP-like парсер: пробелы/NBSP как группировка, ',' как десятичный.
 * Возвращает только finite number или undefined.
 */
export function toFiniteNumber(v: unknown): number | undefined {
	if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
	if (typeof v !== "string") return undefined;

	const trimmed = v.trim();
	if (!trimmed) return undefined;

	const parsed = Number(trimmed);
	if (Number.isFinite(parsed)) return parsed;

	// SAP-like: убираем пробелы/NBSP/NNBSP, поддерживаем ',' как decimal

	let s = "";
	for (let i = 0; i < trimmed.length; i++) {
		const c = trimmed.charCodeAt(i);
		if (c === 32 || c === 160 || c === 8239 || c === 39 /*'*/) continue;
		s += trimmed[i];
	}

	const hasComma = s.indexOf(",") !== -1;
	const hasDot = s.indexOf(".") !== -1;

	if (hasComma && hasDot) {
		s = s.replace(/,/g, ""); // 1,234.56 -> 1234.56
	} else if (hasComma) {
		s = s.replace(/,/g, "."); // 1234,56 -> 1234.56
	}

	const n = Number(s);
	return Number.isFinite(n) ? n : undefined;
}

export function parseNumber(v: unknown): number {
	return toFiniteNumber(v) ?? 0;
}

export function isPositiveValue(value: unknown): boolean {
	const normalizedValue = toFiniteNumber(value);
	if (normalizedValue) {
		return normalizedValue > 0;
	}

	return false;
}

/**
 * Читает положительное целое число из неизвестного значения.
 */
export function toPositiveInteger(value: unknown): number | undefined {
	const normalizedValue = toFiniteNumber(value);
	if (normalizedValue === undefined || !Number.isInteger(normalizedValue) || normalizedValue <= 0) {
		return undefined;
	}

	return normalizedValue;
}
