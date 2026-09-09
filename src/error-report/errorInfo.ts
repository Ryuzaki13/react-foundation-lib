import { normalizeText } from "../formatters";

import { ERROR_REPORT_STACK_TRACE_MAX_BYTES } from "./payload";
import { sanitizeDiagnosticText, sanitizeDiagnosticTextBytes } from "./safeValue";

import type { ErrorReportErrorInfo } from "./types";

const DEFAULT_ERROR_MESSAGE = "Неизвестная ошибка";

/**
 * Гарантирует непустое диагностическое сообщение, сохраняя исходный текст ошибки.
 * Fallback нужен для Error без message и для брошенных пустых строк.
 */
function resolveErrorMessage(message: string) {
	return normalizeText(message) ? sanitizeDiagnosticText(message) : DEFAULT_ERROR_MESSAGE;
}

function readStatus(value: Record<string, unknown>) {
	const status = value.status ?? value.statusCode ?? value.httpStatus;
	return typeof status === "number" && Number.isFinite(status) ? status : undefined;
}

function readServerFnTransportErrorInfo(error: unknown): ErrorReportErrorInfo | null {
	if (!error || typeof error !== "object") {
		return null;
	}

	const transport = error as Record<string, unknown>;
	const appError = transport.appError;
	if (!appError || typeof appError !== "object") {
		return null;
	}

	const payload = appError as Record<string, unknown>;
	const message = normalizeText(payload.message);
	if (!message) {
		return null;
	}

	return {
		name: "AppError",
		message: sanitizeDiagnosticText(message),
		code: normalizeText(payload.code) ? sanitizeDiagnosticText(String(payload.code), 128) : undefined,
		httpStatus: readStatus(payload)
	};
}

/**
 * Нормализует любое брошенное значение в форму, удобную для поиска и сохранения.
 * Stacktrace намеренно сохраняется полностью: это основная диагностическая ценность отчета.
 */
export function createErrorInfo(error: unknown): ErrorReportErrorInfo {
	const serverFnErrorInfo = readServerFnTransportErrorInfo(error);
	if (serverFnErrorInfo) {
		return serverFnErrorInfo;
	}

	if (error instanceof Error) {
		return {
			name: sanitizeDiagnosticText(error.name || "Error", 256),
			message: resolveErrorMessage(error.message),
			stackTrace: error.stack ? sanitizeDiagnosticTextBytes(error.stack, ERROR_REPORT_STACK_TRACE_MAX_BYTES) : undefined
		};
	}

	if (error && typeof error === "object") {
		const record = error as Record<string, unknown>;
		return {
			name: sanitizeDiagnosticText(typeof record.name === "string" ? record.name : "Error", 256),
			message: resolveErrorMessage(typeof record.message === "string" ? record.message : String(error)),
			stackTrace:
				typeof record.stack === "string"
					? sanitizeDiagnosticTextBytes(record.stack, ERROR_REPORT_STACK_TRACE_MAX_BYTES)
					: undefined,
			httpStatus: readStatus(record)
		};
	}

	return {
		name: "Error",
		message: resolveErrorMessage(typeof error === "string" ? error : String(error ?? DEFAULT_ERROR_MESSAGE))
	};
}
