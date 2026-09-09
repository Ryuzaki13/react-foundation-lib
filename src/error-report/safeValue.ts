import type { ErrorReportSafeValue, ErrorReportSanitizationContext, ErrorReportSanitizer } from "./types";

const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_DIAGNOSTIC_STRING_LENGTH = 4_096;
const REDACTED_VALUE = "[REDACTED]";
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
		const parsed = new URL(value, "https://error-report.invalid");
		const pathname = parsed.pathname;
		return parsed.origin === "https://error-report.invalid" ? pathname : `${parsed.origin}${pathname}`;
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
	const safeEnd = lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff ? left - 1 : left;
	return sanitizedValue.slice(0, safeEnd);
}

type DiagnosticValueState = {
	seen: WeakSet<object>;
	maxStringLength: number;
};

function createDiagnosticValueInternal(value: unknown, depth: number, state: DiagnosticValueState, key?: string): ErrorReportSafeValue {
	if (key && isSensitiveKey(key)) return REDACTED_VALUE;
	if (depth >= MAX_DEPTH) return { type: "truncated" };
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : { type: "non-finite-number" };
	if (typeof value === "string") {
		const normalizedValue = (key && isUrlKey(key)) || looksLikeUrlWithPrivateParts(value) ? stripUrlSearchAndHash(value) : value;
		return sanitizeDiagnosticText(normalizedValue, state.maxStringLength);
	}
	if (value === undefined) return { type: "undefined" };
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? { type: "invalid-date" } : value.toISOString();
	if (typeof value === "object") {
		if (state.seen.has(value)) return { type: "circular" };
		state.seen.add(value);
	}
	if (Array.isArray(value)) {
		return value.slice(0, MAX_ARRAY_ITEMS).map((item) => createDiagnosticValueInternal(item, depth + 1, state));
	}
	if (typeof value === "object") {
		try {
			const entries = Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.slice(0, MAX_OBJECT_KEYS);

			return Object.fromEntries(
				entries.map(([entryKey, item]) => [entryKey, createDiagnosticValueInternal(item, depth + 1, state, entryKey)])
			);
		} catch {
			return { type: "unreadable" };
		}
	}
	if (typeof value === "function") return { type: "function" };
	if (typeof value === "symbol") return { type: "symbol" };
	if (typeof value === "bigint") return value.toString();

	return { type: "unknown" };
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
	const createBoundedValue = (candidate: unknown) =>
		createDiagnosticValueInternal(candidate, 0, { seen: new WeakSet(), maxStringLength });
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
	context: ErrorReportSanitizationContext = { scope: "context" }
): Record<string, ErrorReportSafeValue> | undefined {
	if (!detail) return undefined;

	const sanitizedValue = sanitizeErrorReportValue(detail, context);
	if (!sanitizedValue || Array.isArray(sanitizedValue) || typeof sanitizedValue !== "object") return undefined;

	return Object.keys(sanitizedValue).length ? sanitizedValue : undefined;
}
