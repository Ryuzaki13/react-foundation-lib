import type { ErrorReportSafeValue } from "./types";

const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;

/**
 * Превращает произвольное значение в JSON-совместимую диагностическую форму.
 * Значения сохраняются читаемыми, потому что queryKey/meta/context нужны
 * для восстановления пользовательского сценария; тяжелые данные query cache
 * отсекаются отдельно и сюда не передаются.
 */
export function createDiagnosticValue(value: unknown, depth = 0): ErrorReportSafeValue {
	if (depth >= MAX_DEPTH) return { type: "truncated" };
	if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	if (value === undefined) return { type: "undefined" };
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) {
		return value.slice(0, MAX_ARRAY_ITEMS).map((item) => createDiagnosticValue(item, depth + 1));
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);

		return Object.fromEntries(entries.map(([key, item]) => [key, createDiagnosticValue(item, depth + 1)]));
	}
	if (typeof value === "function") return { type: "function" };
	if (typeof value === "symbol") return { type: "symbol" };
	if (typeof value === "bigint") return value.toString();

	return { type: "unknown" };
}

/**
 * Описывает форму данных кеша без самих значений: типы, размеры массивов и ключи объектов.
 */
export function createDataShape(value: unknown, depth = 0): ErrorReportSafeValue {
	if (depth >= MAX_DEPTH) return { type: "truncated" };
	if (value === null) return { type: "null" };
	if (value === undefined) return { type: "undefined" };
	if (Array.isArray(value)) {
		return {
			type: "array",
			length: value.length,
			firstItemsShape: value.slice(0, 3).map((item) => createDataShape(item, depth + 1))
		};
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);

		return {
			type: "object",
			keys: entries.map(([key]) => key),
			shape: Object.fromEntries(entries.map(([key, item]) => [key, createDataShape(item, depth + 1)]))
		};
	}

	return { type: typeof value };
}

export function sanitizeDetail(detail: Record<string, unknown> | undefined): Record<string, ErrorReportSafeValue> | undefined {
	if (!detail) return undefined;

	const entries = Object.entries(detail)
		.slice(0, MAX_OBJECT_KEYS)
		.map(([key, value]) => [key, createDiagnosticValue(value)] as const);

	return entries.length ? Object.fromEntries(entries) : undefined;
}
