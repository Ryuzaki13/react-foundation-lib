import { getErrorReportCaptureOptions } from "./captureOptions";
import { ERROR_REPORT_VALUE_POLICY_VERBATIM } from "./capturePolicyConstants";
import {
	ERROR_REPORT_SAFE_STRING_MAX_LENGTH,
	ERROR_REPORT_SAFE_ARRAY_MAX_ITEMS,
	ERROR_REPORT_SAFE_OBJECT_MAX_KEYS
} from "./errorReportCaptureLimits";
import {
	ERROR_REPORT_SCOPE_QUERY_KEY,
	ERROR_REPORT_SCOPE_MUTATION_KEY,
	ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY,
	ERROR_REPORT_SCOPE_CONTEXT
} from "./errorReportContractConstants";
import {
	REDACTED_VALUE,
	HIGH_SURROGATE_FIRST,
	HIGH_SURROGATE_LAST,
	SAFE_VALUE_TYPE_TRUNCATED,
	SAFE_VALUE_TYPE_NON_FINITE_NUMBER,
	SAFE_VALUE_TYPE_UNDEFINED,
	SAFE_VALUE_TYPE_INVALID_DATE,
	SAFE_VALUE_TYPE_CIRCULAR,
	SAFE_VALUE_TYPE_UNREADABLE,
	SAFE_VALUE_TYPE_FUNCTION,
	SAFE_VALUE_TYPE_SYMBOL,
	SAFE_VALUE_TYPE_UNKNOWN
} from "./safeValueMarkerConstants";

import type { ErrorReportSafeValue, ErrorReportSanitizationContext, ErrorReportSanitizer } from "./types";

const MAX_DEPTH = 4;
const MAX_DIAGNOSTIC_STRING_LENGTH = 4_096;
const MAX_ARRAY_SHAPE_ITEMS = 3;
const RELATIVE_URL_ORIGIN = "https://error-report.invalid";
const TRUNCATED_TEXT_MARKER = "[TRUNCATED]";
const SENSITIVE_KEY_PARTS = [
	"apikey",
	"authorization",
	"cookie",
	"csrf",
	"password",
	"passwd",
	"refreshtoken",
	"secret",
	"sessiontoken",
	"token"
];
const URL_KEY_SUFFIX = "url";

let errorReportSanitizer: ErrorReportSanitizer | undefined;

function normalizeKey(key: string) {
	return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
	const normalizedKey = normalizeKey(key);
	return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
}

function isUrlKey(key: string) {
	return normalizeKey(key).endsWith(URL_KEY_SUFFIX);
}

function looksLikeUrlWithPrivateParts(value: string) {
	return /^(?:https?:\/\/|\/)[^\s]*[?#]/i.test(value);
}

function stripUrlSearchAndHash(value: string) {
	try {
		const parsed = new URL(value, RELATIVE_URL_ORIGIN);
		const pathname = parsed.pathname;
		return parsed.origin === RELATIVE_URL_ORIGIN ? pathname : `${parsed.origin}${pathname}`;
	} catch {
		return value.split(/[?#]/, 1)[0] ?? value;
	}
}

/**
 * Удаляет наиболее узнаваемые секреты и email из свободного диагностического
 * текста. Это страховочная сетка; предметные персональные данные приложение
 * обязано исключить своим allow-list sanitizer.
 */
export function sanitizeDiagnosticText(value: string, maxLength = MAX_DIAGNOSTIC_STRING_LENGTH) {
	if (getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM) {
		if (value.length <= maxLength) return value;
		const marker = `… [TRUNCATED: ${value.length} characters total]`;
		if (marker.length > maxLength) return TRUNCATED_TEXT_MARKER.slice(0, Math.max(0, maxLength));
		const prefix = value.slice(0, Math.max(0, maxLength - marker.length));
		const lastCodeUnit = prefix.charCodeAt(prefix.length - 1);
		const safePrefix = lastCodeUnit >= HIGH_SURROGATE_FIRST && lastCodeUnit <= HIGH_SURROGATE_LAST ? prefix.slice(0, -1) : prefix;
		return `${safePrefix}${marker}`;
	}
	let sanitizedValue = value.slice(0, maxLength);
	if (/\bbearer\s/i.test(sanitizedValue)) {
		sanitizedValue = sanitizedValue.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [REDACTED]");
	}
	if (sanitizedValue.includes("@")) {
		sanitizedValue = sanitizedValue.replace(/[A-Z0-9._%+-]{1,254}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}/gi, "[REDACTED_EMAIL]");
	}

	return sanitizedValue;
}

/** Возвращает размер строки в UTF-8, совпадающий с размером JSON transport. */
export function getUtf8TextSize(value: string) {
	return new TextEncoder().encode(value).byteLength;
}

/**
 * Обрезает уже очищенный текст по UTF-8 bytes без разрыва surrogate pair.
 * Binary search нужен для Unicode stack traces, где число code units не равно
 * размеру transport payload.
 */
export function sanitizeDiagnosticTextBytes(value: string, maxBytes: number) {
	if (getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM) {
		const originalBytes = getUtf8TextSize(value);
		if (originalBytes <= maxBytes) return value;
		const marker = `… [TRUNCATED: ${originalBytes} UTF-8 bytes total]`;
		if (getUtf8TextSize(marker) > maxBytes) return TRUNCATED_TEXT_MARKER.slice(0, Math.max(0, maxBytes));
		const prefixLimit = Math.max(0, maxBytes - getUtf8TextSize(marker));
		let left = 0;
		let right = value.length;
		while (left < right) {
			const middle = Math.ceil((left + right) / 2);
			if (getUtf8TextSize(value.slice(0, middle)) <= prefixLimit) left = middle;
			else right = middle - 1;
		}
		const lastCodeUnit = value.charCodeAt(left - 1);
		const safeEnd = lastCodeUnit >= HIGH_SURROGATE_FIRST && lastCodeUnit <= HIGH_SURROGATE_LAST ? left - 1 : left;
		return `${value.slice(0, safeEnd)}${marker}`;
	}
	const sanitizedValue = sanitizeDiagnosticText(value, maxBytes);
	if (getUtf8TextSize(sanitizedValue) <= maxBytes) return sanitizedValue;

	let left = 0;
	let right = sanitizedValue.length;
	while (left < right) {
		const middle = Math.ceil((left + right) / 2);
		if (getUtf8TextSize(sanitizedValue.slice(0, middle)) <= maxBytes) left = middle;
		else right = middle - 1;
	}

	const lastCodeUnit = sanitizedValue.charCodeAt(left - 1);
	const safeEnd = lastCodeUnit >= HIGH_SURROGATE_FIRST && lastCodeUnit <= HIGH_SURROGATE_LAST ? left - 1 : left;
	return sanitizedValue.slice(0, safeEnd);
}

type DiagnosticValueState = {
	seen: WeakSet<object>;
	maxStringLength: number;
};

function createDiagnosticValueInternal(value: unknown, depth: number, state: DiagnosticValueState, key?: string): ErrorReportSafeValue {
	const verbatim = getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM;
	if (!verbatim && key && isSensitiveKey(key)) return REDACTED_VALUE;
	if (depth >= MAX_DEPTH) return { type: SAFE_VALUE_TYPE_TRUNCATED };
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : { type: SAFE_VALUE_TYPE_NON_FINITE_NUMBER };
	if (typeof value === "string") {
		const normalizedValue =
			!verbatim && ((key && isUrlKey(key)) || looksLikeUrlWithPrivateParts(value)) ? stripUrlSearchAndHash(value) : value;
		return sanitizeDiagnosticText(normalizedValue, state.maxStringLength);
	}
	if (value === undefined) return { type: SAFE_VALUE_TYPE_UNDEFINED };
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? { type: SAFE_VALUE_TYPE_INVALID_DATE } : value.toISOString();
	if (typeof value === "object") {
		if (state.seen.has(value)) return { type: SAFE_VALUE_TYPE_CIRCULAR };
		state.seen.add(value);
	}
	if (Array.isArray(value)) {
		const keptItems =
			verbatim && value.length > ERROR_REPORT_SAFE_ARRAY_MAX_ITEMS
				? ERROR_REPORT_SAFE_ARRAY_MAX_ITEMS - 1
				: ERROR_REPORT_SAFE_ARRAY_MAX_ITEMS;
		const items = value.slice(0, keptItems).map((item) => createDiagnosticValueInternal(item, depth + 1, state));
		if (verbatim && value.length > keptItems) items.push({ type: SAFE_VALUE_TYPE_TRUNCATED, omittedItems: value.length - keptItems });
		return items;
	}
	if (typeof value === "object") {
		try {
			const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
			const keptKeys =
				verbatim && entries.length > ERROR_REPORT_SAFE_OBJECT_MAX_KEYS
					? ERROR_REPORT_SAFE_OBJECT_MAX_KEYS - 1
					: ERROR_REPORT_SAFE_OBJECT_MAX_KEYS;
			const result: Record<string, ErrorReportSafeValue> = Object.fromEntries(
				entries
					.slice(0, keptKeys)
					.map(([entryKey, item]) => [entryKey, createDiagnosticValueInternal(item, depth + 1, state, entryKey)])
			);
			if (verbatim && entries.length > keptKeys) {
				let markerKey = "$truncated";
				while (Object.hasOwn(value, markerKey)) markerKey += "_";
				result[markerKey] = { type: SAFE_VALUE_TYPE_TRUNCATED, omittedKeys: entries.length - keptKeys };
			}
			return result;
		} catch {
			return { type: SAFE_VALUE_TYPE_UNREADABLE };
		}
	}
	if (typeof value === "function") return { type: SAFE_VALUE_TYPE_FUNCTION };
	if (typeof value === "symbol") return { type: SAFE_VALUE_TYPE_SYMBOL };
	if (typeof value === "bigint") return value.toString();

	return { type: SAFE_VALUE_TYPE_UNKNOWN };
}

/**
 * Превращает произвольное значение в JSON-совместимую диагностическую форму.
 * Значения сохраняются читаемыми, потому что queryKey/meta/context нужны
 * для восстановления пользовательского сценария; тяжелые данные query cache
 * отсекаются отдельно и сюда не передаются.
 */
export function createDiagnosticValue(value: unknown, depth = 0): ErrorReportSafeValue {
	return createDiagnosticValueInternal(value, depth, {
		seen: new WeakSet(),
		maxStringLength: MAX_DIAGNOSTIC_STRING_LENGTH
	});
}

/**
 * Описывает форму данных кеша без самих значений: типы, размеры массивов и ключи объектов.
 */
export function createDataShape(value: unknown, depth = 0): ErrorReportSafeValue {
	if (depth >= MAX_DEPTH) return { type: SAFE_VALUE_TYPE_TRUNCATED };
	if (value === null) return { type: "null" };
	if (value === undefined) return { type: SAFE_VALUE_TYPE_UNDEFINED };
	if (Array.isArray(value)) {
		return {
			type: "array",
			length: value.length,
			firstItemsShape: value.slice(0, MAX_ARRAY_SHAPE_ITEMS).map((item) => createDataShape(item, depth + 1))
		};
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).slice(0, ERROR_REPORT_SAFE_OBJECT_MAX_KEYS);

		return {
			type: "object",
			keys: entries.map(([key]) => key),
			shape: Object.fromEntries(entries.map(([key, item]) => [key, createDataShape(item, depth + 1)]))
		};
	}

	return { type: typeof value };
}

/**
 * Подключает предметный sanitizer приложения. `undefined` отключает callback и
 * одновременно предотвращает утечку старой policy при hot reload и в тестах.
 */
export function setErrorReportSanitizer(sanitizer: ErrorReportSanitizer | undefined) {
	errorReportSanitizer = sanitizer;
}

/**
 * Выполняет built-in нормализацию, затем предметную policy приложения и ещё
 * одну bounded-нормализацию результата перед включением секции в payload.
 */
export function sanitizeErrorReportValue(
	value: unknown,
	context: ErrorReportSanitizationContext,
	maxStringLength = MAX_DIAGNOSTIC_STRING_LENGTH
) {
	const keyScope =
		context.scope === ERROR_REPORT_SCOPE_QUERY_KEY ||
		context.scope === ERROR_REPORT_SCOPE_MUTATION_KEY ||
		context.scope === ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY;
	const effectiveMaxStringLength =
		getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM && keyScope
			? Math.max(maxStringLength, ERROR_REPORT_SAFE_STRING_MAX_LENGTH)
			: maxStringLength;
	const createBoundedValue = (candidate: unknown) =>
		createDiagnosticValueInternal(candidate, 0, { seen: new WeakSet(), maxStringLength: effectiveMaxStringLength });
	const safeValue = createBoundedValue(value);
	if (!errorReportSanitizer) return safeValue;

	try {
		const appSanitizedValue = errorReportSanitizer(safeValue, context);
		return appSanitizedValue === undefined ? undefined : createBoundedValue(appSanitizedValue);
	} catch {
		// Ошибка optional sanitizer безопаснее приводит к удалению секции, а не к
		// сохранению потенциально чувствительного исходного значения.
		return undefined;
	}
}

export function sanitizeDetail(
	detail: Record<string, unknown> | undefined,
	context: ErrorReportSanitizationContext = { scope: ERROR_REPORT_SCOPE_CONTEXT }
): Record<string, ErrorReportSafeValue> | undefined {
	if (!detail) return undefined;

	const sanitizedValue = sanitizeErrorReportValue(detail, context);
	if (!sanitizedValue || Array.isArray(sanitizedValue) || typeof sanitizedValue !== "object") return undefined;

	return Object.keys(sanitizedValue).length ? sanitizedValue : undefined;
}
