import {
	type QUEUE_FAILURE_HTTP,
	type QUEUE_FAILURE_NETWORK,
	type QUEUE_FAILURE_TIMEOUT,
	type QUEUE_FAILURE_UNKNOWN,
	type QUEUE_ENQUEUE_ACCEPTED,
	type QUEUE_ENQUEUE_DUPLICATE,
	type QUEUE_ENQUEUE_INVALID_PAYLOAD,
	type QUEUE_ENQUEUE_CAPACITY_EXCEEDED,
	type QUEUE_TRANSITION_UPDATED,
	type QUEUE_TRANSITION_MISSING,
	type QUEUE_TRANSITION_LEASE_MISMATCH
} from "./queueResultConstants";
import { type ErrorReportPayload } from "./types";

export const ERROR_REPORT_QUEUE_VERSION = 1 as const;
export const ERROR_REPORT_QUEUE_MAX_ITEMS = 50;
export const ERROR_REPORT_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const ERROR_REPORT_QUEUE_LEASE_MS = 30 * 1_000;

export type ErrorReportQueueFailureKind =
	typeof QUEUE_FAILURE_HTTP | typeof QUEUE_FAILURE_NETWORK | typeof QUEUE_FAILURE_TIMEOUT | typeof QUEUE_FAILURE_UNKNOWN;

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
	| { readonly status: typeof QUEUE_ENQUEUE_ACCEPTED; readonly evictedReportId?: string }
	| { readonly status: typeof QUEUE_ENQUEUE_DUPLICATE }
	| { readonly status: typeof QUEUE_ENQUEUE_INVALID_PAYLOAD }
	| { readonly status: typeof QUEUE_ENQUEUE_CAPACITY_EXCEEDED };

export type ErrorReportQueueLeaseOptions = {
	readonly ownerId: string;
	readonly now?: Date;
	readonly leaseDurationMs?: number;
};

export type ErrorReportQueueTransitionResult =
	typeof QUEUE_TRANSITION_UPDATED | typeof QUEUE_TRANSITION_MISSING | typeof QUEUE_TRANSITION_LEASE_MISMATCH;

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
