import { normalizeText } from "../formatters";

import { getErrorReportCaptureOptions } from "./captureOptions";
import { ERROR_REPORT_VALUE_POLICY_VERBATIM } from "./capturePolicyConstants";
import { ERROR_REPORT_ERROR_NAME_MAX_LENGTH, ERROR_REPORT_ERROR_CODE_MAX_LENGTH } from "./errorReportCaptureLimits";
import { ERROR_REPORT_STACK_TRACE_MAX_BYTES, ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES } from "./payload";
import { sanitizeDiagnosticText, sanitizeDiagnosticTextBytes } from "./safeValue";

import type { ErrorReportErrorInfo } from "./types";

const DEFAULT_ERROR_MESSAGE = "Неизвестная ошибка";
const DEFAULT_ERROR_NAME = "Error";

/**
 * Гарантирует непустое диагностическое сообщение, сохраняя исходный текст ошибки.
 * Fallback нужен для Error без message и для брошенных пустых строк.
 */
function resolveErrorMessage(message: string) {
	if (!normalizeText(message)) return DEFAULT_ERROR_MESSAGE;
	return getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM
		? sanitizeDiagnosticTextBytes(message, ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES)
		: sanitizeDiagnosticText(message);
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
		message: resolveErrorMessage(message),
		code: normalizeText(payload.code) ? sanitizeDiagnosticText(String(payload.code), ERROR_REPORT_ERROR_CODE_MAX_LENGTH) : undefined,
		httpStatus: readStatus(payload)
	};
}

/**
 * Нормализует любое брошенное значение в форму, удобную для поиска и сохранения.
 * Stacktrace сохраняется до 64 KiB как основной диагностический контекст;
 * в verbatim-режиме превышение этого предела отмечается внутри строки.
 */
export function createErrorInfo(error: unknown): ErrorReportErrorInfo {
	const serverFnErrorInfo = readServerFnTransportErrorInfo(error);
	if (serverFnErrorInfo) {
		return serverFnErrorInfo;
	}

	if (error instanceof Error) {
		return {
			name: sanitizeDiagnosticText(error.name || DEFAULT_ERROR_NAME, ERROR_REPORT_ERROR_NAME_MAX_LENGTH),
			message: resolveErrorMessage(error.message),
			stackTrace: error.stack ? sanitizeDiagnosticTextBytes(error.stack, ERROR_REPORT_STACK_TRACE_MAX_BYTES) : undefined
		};
	}

	if (error && typeof error === "object") {
		const record = error as Record<string, unknown>;
		return {
			name: sanitizeDiagnosticText(
				typeof record.name === "string" ? record.name : DEFAULT_ERROR_NAME,
				ERROR_REPORT_ERROR_NAME_MAX_LENGTH
			),
			message: resolveErrorMessage(typeof record.message === "string" ? record.message : String(error)),
			stackTrace:
				typeof record.stack === "string"
					? sanitizeDiagnosticTextBytes(record.stack, ERROR_REPORT_STACK_TRACE_MAX_BYTES)
					: undefined,
			httpStatus: readStatus(record)
		};
	}

	return {
		name: DEFAULT_ERROR_NAME,
		message: resolveErrorMessage(typeof error === "string" ? error : String(error ?? DEFAULT_ERROR_MESSAGE))
	};
}
