import { createIndexedDbQueryStorage, type IndexedDbQueryStorage } from "../query-client";

import {
	ERROR_REPORT_QUEUE_LEASE_MS,
	ERROR_REPORT_QUEUE_MAX_ITEMS,
	ERROR_REPORT_QUEUE_TTL_MS,
	ERROR_REPORT_QUEUE_VERSION,
	type ErrorReportQueue,
	type ErrorReportQueueEnqueueResult,
	type ErrorReportQueueRecord,
	type ErrorReportQueueTransitionResult
} from "./queueContract";
import { normalizeErrorReportQueueRecords } from "./queueRecord";
import { parseErrorReportPayload } from "./schema";
import { type ErrorReportPayload } from "./types";

const QUEUE_STORAGE_KEY = "queue.v1";
const QUEUE_STORE_NAME = "records";

export type CreateErrorReportQueueOptions = {
	readonly dbName?: string;
	readonly indexedDB?: IDBFactory;
	/** Тестовая/альтернативная storage boundary; browser-приложения обычно её не задают. */
	readonly storage?: Pick<IndexedDbQueryStorage<unknown>, "getItem" | "updateItem">;
};

function toUtc(value: number) {
	return new Date(value).toISOString();
}

function normalizeOwnerId(value: string) {
	const ownerId = value.trim();
	if (ownerId.length === 0 || ownerId.length > 128) {
		throw new Error("Error report lease owner должен содержать от 1 до 128 символов");
	}
	return ownerId;
}

function compareQueueOrder(left: ErrorReportQueueRecord, right: ErrorReportQueueRecord) {
	return (
		Date.parse(left.nextAttemptUtc) - Date.parse(right.nextAttemptUtc) || Date.parse(left.enqueuedUtc) - Date.parse(right.enqueuedUtc)
	);
}

function resolveTransition(
	records: ErrorReportQueueRecord[],
	reportId: string,
	ownerId: string
): { readonly index: number; readonly result: ErrorReportQueueTransitionResult } {
	const index = records.findIndex((record) => record.reportId === reportId);
	if (index < 0) return { index, result: "missing" };
	if (records[index]?.lease?.ownerId !== ownerId) return { index, result: "lease-mismatch" };
	return { index, result: "updated" };
}

/**
 * Создаёт IndexedDB-backed очередь. Одна запись-envelope намеренно хранит не
 * более 50 payload: существующий atomic update primitive тогда сериализует
 * выбор lease между вкладками без дополнительного локального storage слоя.
 */
export function createErrorReportQueue(options: CreateErrorReportQueueOptions = {}): ErrorReportQueue | undefined {
	const storage =
		options.storage ??
		createIndexedDbQueryStorage<unknown>({
			dbName: options.dbName ?? `${__APP_ID__}.error-report.queue.v1`,
			storeName: QUEUE_STORE_NAME,
			indexedDB: options.indexedDB
		});
	if (!storage) return undefined;
	const queueStorage = storage;

	function update<TResult>(
		nowMs: number,
		operation: (records: ErrorReportQueueRecord[]) => { readonly records: ErrorReportQueueRecord[]; readonly result: TResult }
	) {
		return queueStorage.updateItem(QUEUE_STORAGE_KEY, (storedValue) => {
			const decision = operation(normalizeErrorReportQueueRecords(storedValue, nowMs));
			return { action: "set" as const, value: decision.records, result: decision.result };
		});
	}

	return {
		enqueue: async (payload: ErrorReportPayload, now = new Date()) => {
			const parsedPayload = parseErrorReportPayload(payload);
			if (!parsedPayload) return { status: "invalid-payload" as const };

			const nowMs = now.getTime();
			if (!Number.isFinite(nowMs)) return { status: "invalid-payload" as const };

			return update<ErrorReportQueueEnqueueResult>(nowMs, (records) => {
				if (records.some((record) => record.reportId === parsedPayload.reportId)) {
					return { records, result: { status: "duplicate" as const } };
				}

				let evictedReportId: string | undefined;
				if (records.length >= ERROR_REPORT_QUEUE_MAX_ITEMS) {
					const evictedIndex = records
						.map((record, index) => ({ record, index }))
						.filter(({ record }) => record.lease === undefined)
						.sort((left, right) => Date.parse(left.record.enqueuedUtc) - Date.parse(right.record.enqueuedUtc))[0]?.index;

					if (evictedIndex === undefined) {
						return { records, result: { status: "capacity-exceeded" as const } };
					}

					evictedReportId = records[evictedIndex]?.reportId;
					records.splice(evictedIndex, 1);
				}

				const nowUtc = toUtc(nowMs);
				records.push({
					queueVersion: ERROR_REPORT_QUEUE_VERSION,
					reportId: parsedPayload.reportId,
					enqueuedUtc: nowUtc,
					expiresUtc: toUtc(nowMs + ERROR_REPORT_QUEUE_TTL_MS),
					nextAttemptUtc: nowUtc,
					attemptCount: 0,
					payload: parsedPayload
				});

				return {
					records,
					result: evictedReportId ? { status: "enqueued" as const, evictedReportId } : { status: "enqueued" as const }
				};
			});
		},
		leaseNext: async ({ ownerId: inputOwnerId, now = new Date(), leaseDurationMs = ERROR_REPORT_QUEUE_LEASE_MS }) => {
			const ownerId = normalizeOwnerId(inputOwnerId);
			const nowMs = now.getTime();
			if (!Number.isFinite(nowMs) || !Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
				throw new Error("Error report lease требует валидное время и положительную длительность");
			}

			return update(nowMs, (records) => {
				const record = records
					.filter(
						(candidate) =>
							Date.parse(candidate.nextAttemptUtc) <= nowMs &&
							(candidate.lease === undefined || Date.parse(candidate.lease.expiresUtc) <= nowMs)
					)
					.sort(compareQueueOrder)[0];
				if (!record) return { records, result: undefined };

				const leasedRecord: ErrorReportQueueRecord = {
					...record,
					attemptCount: record.attemptCount + 1,
					lease: { ownerId, expiresUtc: toUtc(nowMs + leaseDurationMs) }
				};
				return {
					records: records.map((candidate) => (candidate.reportId === record.reportId ? leasedRecord : candidate)),
					result: leasedRecord
				};
			});
		},
		acknowledge: async (reportId, inputOwnerId) => {
			const ownerId = normalizeOwnerId(inputOwnerId);
			return update(Date.now(), (records) => {
				const transition = resolveTransition(records, reportId, ownerId);
				if (transition.result !== "updated") return { records, result: transition.result };
				records.splice(transition.index, 1);
				return { records, result: "updated" as const };
			});
		},
		reschedule: async (reportId, inputOwnerId, retry) => {
			const ownerId = normalizeOwnerId(inputOwnerId);
			const nextAttemptMs = Date.parse(retry.nextAttemptUtc);
			const failureUtcMs = Date.parse(retry.failure.utc);
			if (!Number.isFinite(nextAttemptMs) || !Number.isFinite(failureUtcMs)) {
				throw new Error("Error report retry требует валидные UTC timestamps");
			}

			return update(failureUtcMs, (records) => {
				const transition = resolveTransition(records, reportId, ownerId);
				if (transition.result !== "updated") return { records, result: transition.result };
				const record = records[transition.index];
				if (!record) return { records, result: "missing" as const };
				records[transition.index] = {
					...record,
					nextAttemptUtc: retry.nextAttemptUtc,
					lease: undefined,
					lastFailure: retry.failure
				};
				return { records, result: "updated" as const };
			});
		},
		discard: async (reportId, inputOwnerId) => {
			const ownerId = normalizeOwnerId(inputOwnerId);
			return update(Date.now(), (records) => {
				const transition = resolveTransition(records, reportId, ownerId);
				if (transition.result !== "updated") return { records, result: transition.result };
				records.splice(transition.index, 1);
				return { records, result: "updated" as const };
			});
		},
		getRecords: async (now = new Date()) => {
			const nowMs = now.getTime();
			if (!Number.isFinite(nowMs)) return [];
			const storedValue = await queueStorage.getItem(QUEUE_STORAGE_KEY);
			return normalizeErrorReportQueueRecords(storedValue, nowMs).sort(compareQueueOrder);
		},
		getNextWakeUtc: async (now = new Date()) => {
			const nowMs = now.getTime();
			if (!Number.isFinite(nowMs)) return undefined;
			const records = normalizeErrorReportQueueRecords(await queueStorage.getItem(QUEUE_STORAGE_KEY), nowMs);
			const nextWakeMs = records.reduce<number | undefined>((current, record) => {
				const recordWakeMs = Math.max(Date.parse(record.nextAttemptUtc), record.lease ? Date.parse(record.lease.expiresUtc) : 0);
				return current === undefined || recordWakeMs < current ? recordWakeMs : current;
			}, undefined);
			return nextWakeMs === undefined ? undefined : toUtc(nextWakeMs);
		}
	};
}
