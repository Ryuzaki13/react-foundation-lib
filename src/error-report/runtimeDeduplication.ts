import { hashString128 } from "../crypto";
import { stableStringify } from "../utils";

import type { ErrorReportDraft, ErrorReportErrorInfo, ErrorReportSafeValue } from "./types";

export const RUNTIME_ERROR_REPORT_DEDUPLICATION_WINDOW_MS = 60_000;

const MAX_RECENT_RUNTIME_ERROR_REPORTS = 100;
const recentRuntimeErrorReports = new Map<
	string,
	{
		capturedAt: number;
		capture: Promise<ErrorReportDraft | undefined>;
		expirationTimer: ReturnType<typeof setTimeout>;
	}
>();

type RuntimeErrorReportDeduplicationInput = {
	category: "runtime" | "react";
	source: string;
	error: ErrorReportErrorInfo;
	pathname?: string;
	scope?: {
		componentStack?: string;
		detail?: Record<string, ErrorReportSafeValue>;
	};
};

function normalizeStackTrace(stackTrace: string | undefined) {
	if (!stackTrace) return undefined;

	return stackTrace
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function createRuntimeErrorReportFingerprint(input: RuntimeErrorReportDeduplicationInput) {
	return hashString128(
		stableStringify({
			category: input.category,
			source: input.source,
			error: {
				...input.error,
				stackTrace: normalizeStackTrace(input.error.stackTrace)
			},
			pathname: input.pathname,
			scope: input.scope
		})
	);
}

/**
 * Удаляет только ожидаемую запись и освобождает связанный таймер.
 * Проверка Promise защищает новую запись того же fingerprint от завершения
 * или отклонения старого capture после lifecycle-сброса.
 */
function removeRuntimeErrorReport(fingerprint: string, expectedCapture?: Promise<ErrorReportDraft | undefined>) {
	const recentReport = recentRuntimeErrorReports.get(fingerprint);
	if (!recentReport || (expectedCapture && recentReport.capture !== expectedCapture)) {
		return;
	}

	clearTimeout(recentReport.expirationTimer);
	recentRuntimeErrorReports.delete(fingerprint);
}

function removeExpiredRuntimeErrorReports(now: number) {
	for (const [fingerprint, recentReport] of recentRuntimeErrorReports) {
		if (now - recentReport.capturedAt >= RUNTIME_ERROR_REPORT_DEDUPLICATION_WINDOW_MS) {
			removeRuntimeErrorReport(fingerprint, recentReport.capture);
		}
	}
}

function removeOldestRuntimeErrorReport() {
	const oldestFingerprint = recentRuntimeErrorReports.keys().next().value;
	if (oldestFingerprint) {
		removeRuntimeErrorReport(oldestFingerprint);
	}
}

/**
 * Объединяет одинаковые runtime capture-вызовы вокруг одной Promise.
 * Все потребители получают один draft, поэтому capture-only boundary не может
 * заблокировать последующую app-level доставку того же отчёта.
 */
export function coalesceRuntimeErrorReportCapture(
	input: RuntimeErrorReportDeduplicationInput,
	capture: () => Promise<ErrorReportDraft | undefined>
) {
	const now = Date.now();
	const fingerprint = createRuntimeErrorReportFingerprint(input);
	const recentReport = recentRuntimeErrorReports.get(fingerprint);

	if (recentReport && now - recentReport.capturedAt < RUNTIME_ERROR_REPORT_DEDUPLICATION_WINDOW_MS) {
		return recentReport.capture;
	}

	removeExpiredRuntimeErrorReports(now);
	while (recentRuntimeErrorReports.size >= MAX_RECENT_RUNTIME_ERROR_REPORTS) {
		removeOldestRuntimeErrorReport();
	}

	const capturePromise = capture();
	const expirationTimer = setTimeout(() => {
		removeRuntimeErrorReport(fingerprint, capturePromise);
	}, RUNTIME_ERROR_REPORT_DEDUPLICATION_WINDOW_MS);

	recentRuntimeErrorReports.set(fingerprint, {
		capturedAt: now,
		capture: capturePromise,
		expirationTimer
	});

	void capturePromise.catch(() => {
		removeRuntimeErrorReport(fingerprint, capturePromise);
	});

	return capturePromise;
}

/**
 * Очищает модульное состояние при смене app-level runtime reporter.
 * Функция не входит в публичный package subpath и нужна lifecycle-коду и тестам.
 */
export function clearRuntimeErrorReportDeduplication() {
	for (const recentReport of recentRuntimeErrorReports.values()) {
		clearTimeout(recentReport.expirationTimer);
	}
	recentRuntimeErrorReports.clear();
}
