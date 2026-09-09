import {
	ERROR_REPORT_QUEUE_MAX_ITEMS,
	ERROR_REPORT_QUEUE_VERSION,
	type ErrorReportQueueFailureKind,
	type ErrorReportQueueRecord
} from "./queueContract";
import { parseErrorReportPayload } from "./schema";

const FAILURE_KINDS = new Set<ErrorReportQueueFailureKind>(["http", "network", "timeout", "unknown"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtc(value: unknown): value is string {
	return typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function isSafeCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseFailure(value: unknown): ErrorReportQueueRecord["lastFailure"] {
	if (value === undefined) return undefined;
	if (!isRecord(value) || !isUtc(value.utc) || typeof value.kind !== "string") return undefined;
	if (!FAILURE_KINDS.has(value.kind as ErrorReportQueueFailureKind)) return undefined;
	if (
		value.httpStatus !== undefined &&
		(typeof value.httpStatus !== "number" || !Number.isInteger(value.httpStatus) || value.httpStatus < 100 || value.httpStatus > 599)
	) {
		return undefined;
	}

	return {
		utc: value.utc,
		kind: value.kind as ErrorReportQueueFailureKind,
		httpStatus: value.httpStatus as number | undefined
	};
}

function parseLease(value: unknown): ErrorReportQueueRecord["lease"] {
	if (value === undefined) return undefined;
	if (!isRecord(value) || typeof value.ownerId !== "string" || value.ownerId.length === 0 || value.ownerId.length > 128) {
		return undefined;
	}
	if (!isUtc(value.expiresUtc)) return undefined;

	return { ownerId: value.ownerId, expiresUtc: value.expiresUtc };
}

/**
 * Queue parser не угадывает прежние storage-формы. Повреждённая или будущая
 * запись отбрасывается отдельно, не уничтожая соседние валидные отчёты.
 */
export function parseErrorReportQueueRecord(value: unknown): ErrorReportQueueRecord | undefined {
	if (!isRecord(value) || value.queueVersion !== ERROR_REPORT_QUEUE_VERSION) return undefined;
	if (typeof value.reportId !== "string" || !isUtc(value.enqueuedUtc) || !isUtc(value.expiresUtc)) return undefined;
	if (!isUtc(value.nextAttemptUtc) || !isSafeCount(value.attemptCount)) return undefined;

	const payload = parseErrorReportPayload(value.payload);
	if (!payload || payload.reportId !== value.reportId) return undefined;

	const lease = parseLease(value.lease);
	if (value.lease !== undefined && !lease) return undefined;
	const lastFailure = parseFailure(value.lastFailure);
	if (value.lastFailure !== undefined && !lastFailure) return undefined;

	return {
		queueVersion: ERROR_REPORT_QUEUE_VERSION,
		reportId: value.reportId,
		enqueuedUtc: value.enqueuedUtc,
		expiresUtc: value.expiresUtc,
		nextAttemptUtc: value.nextAttemptUtc,
		attemptCount: value.attemptCount,
		payload,
		lease,
		lastFailure
	};
}

/** Возвращает bounded текущую очередь без истёкших и повторяющихся ID. */
export function normalizeErrorReportQueueRecords(value: unknown, nowMs: number): ErrorReportQueueRecord[] {
	if (!Array.isArray(value)) return [];

	const reportIds = new Set<string>();
	const records: ErrorReportQueueRecord[] = [];
	for (const valueRecord of value) {
		const record = parseErrorReportQueueRecord(valueRecord);
		if (!record || Date.parse(record.expiresUtc) <= nowMs || reportIds.has(record.reportId)) continue;

		reportIds.add(record.reportId);
		records.push(record);
		if (records.length === ERROR_REPORT_QUEUE_MAX_ITEMS) break;
	}

	return records;
}
