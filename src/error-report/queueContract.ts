import { type ErrorReportPayload } from "./types";

export const ERROR_REPORT_QUEUE_VERSION = 1 as const;
export const ERROR_REPORT_QUEUE_MAX_ITEMS = 50;
export const ERROR_REPORT_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const ERROR_REPORT_QUEUE_LEASE_MS = 30 * 1_000;

export type ErrorReportQueueFailureKind = "http" | "network" | "timeout" | "unknown";

export type ErrorReportQueueRecord = {
	readonly queueVersion: typeof ERROR_REPORT_QUEUE_VERSION;
	readonly reportId: string;
	readonly enqueuedUtc: string;
	readonly expiresUtc: string;
	readonly nextAttemptUtc: string;
	readonly attemptCount: number;
	readonly payload: ErrorReportPayload;
	readonly lease?: {
		readonly ownerId: string;
		readonly expiresUtc: string;
	};
	readonly lastFailure?: {
		readonly utc: string;
		readonly kind: ErrorReportQueueFailureKind;
		readonly httpStatus?: number;
	};
};

export type ErrorReportQueueEnqueueResult =
	| { readonly status: "enqueued"; readonly evictedReportId?: string }
	| { readonly status: "duplicate" }
	| { readonly status: "invalid-payload" }
	| { readonly status: "capacity-exceeded" };

export type ErrorReportQueueLeaseOptions = {
	readonly ownerId: string;
	readonly now?: Date;
	readonly leaseDurationMs?: number;
};

export type ErrorReportQueueTransitionResult = "updated" | "missing" | "lease-mismatch";

export type ErrorReportQueueRetry = {
	readonly nextAttemptUtc: string;
	readonly failure: {
		readonly utc: string;
		readonly kind: ErrorReportQueueFailureKind;
		readonly httpStatus?: number;
	};
};

/**
 * Durable queue contract отделяет delivery policy от конкретной IndexedDB
 * реализации. Все переходы, зависящие от lease owner, выполняются атомарно.
 */
export type ErrorReportQueue = {
	readonly enqueue: (payload: ErrorReportPayload, now?: Date) => Promise<ErrorReportQueueEnqueueResult>;
	readonly leaseNext: (options: ErrorReportQueueLeaseOptions) => Promise<ErrorReportQueueRecord | undefined>;
	readonly acknowledge: (reportId: string, ownerId: string) => Promise<ErrorReportQueueTransitionResult>;
	readonly reschedule: (reportId: string, ownerId: string, retry: ErrorReportQueueRetry) => Promise<ErrorReportQueueTransitionResult>;
	readonly discard: (reportId: string, ownerId: string) => Promise<ErrorReportQueueTransitionResult>;
	readonly getRecords: (now?: Date) => Promise<readonly ErrorReportQueueRecord[]>;
	readonly getNextWakeUtc: (now?: Date) => Promise<string | undefined>;
};
