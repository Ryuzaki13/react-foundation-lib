import type { QueryKey } from "@tanstack/react-query";

export type ErrorReportCategory = "query" | "mutation" | "runtime" | "react";

export type ErrorReportStatus = "pending" | "sending" | "sent" | "failed";

export type ErrorReportPayloadVersion = 1;

export type ErrorReportSafeValue = string | number | boolean | null | ErrorReportSafeValue[] | { [key: string]: ErrorReportSafeValue };

export type ErrorReportErrorInfo = {
	name: string;
	message: string;
	code?: string;
	stackTrace?: string;
	httpStatus?: number;
};

export type ErrorReportBreadcrumb = {
	utc: string;
	type: "route" | "click" | "visibility" | "query-error" | "mutation-error" | "runtime-error";
	routeId?: string;
	appId?: string;
	viewId?: string;
	target?: string;
	detail?: Record<string, ErrorReportSafeValue>;
};

export type ErrorReportQueryDiagnostics = {
	queryHash: string;
	queryKey: ErrorReportSafeValue;
	status?: string;
	fetchStatus?: string;
	dataUpdatedAt?: number;
	errorUpdatedAt?: number;
	failureCount?: number;
	isInvalidated?: boolean;
	observersCount?: number;
	meta?: Record<string, ErrorReportSafeValue>;
	dataShape?: ErrorReportSafeValue;
	error?: ErrorReportErrorInfo;
};

export type ErrorReportMutationDiagnostics = {
	mutationKey?: ErrorReportSafeValue;
	status?: string;
	failureCount?: number;
	submittedAt?: number;
	meta?: Record<string, ErrorReportSafeValue>;
	error?: ErrorReportErrorInfo;
};

export type ErrorReportPersistedQueryDiagnostics = {
	buster?: string;
	queryHash?: string;
	queryKey?: ErrorReportSafeValue;
	status?: string;
	fetchStatus?: string;
	dataUpdatedAt?: number;
	errorUpdatedAt?: number;
	failureCount?: number;
	error?: ErrorReportErrorInfo;
};

export type ErrorReportPayload = {
	payloadVersion: ErrorReportPayloadVersion;
	application: string;
	reportId: string;
	sessionId: string;
	createdUtc: string;
	category: ErrorReportCategory;
	source: string;
	error: ErrorReportErrorInfo;
	environment: {
		mode: "development" | "production";
		buildId?: string;
	};
	client?: {
		userAgent?: string;
		language?: string;
		timeZone?: string;
	};
	location?: {
		pathname: string;
		origin?: string;
	};
	viewport?: {
		width: number;
		height: number;
		devicePixelRatio?: number;
	};
	react?: {
		componentStack?: string;
	};
	query?: ErrorReportQueryDiagnostics;
	mutation?: ErrorReportMutationDiagnostics;
	queryClient?: {
		queries: ErrorReportQueryDiagnostics[];
		mutations: ErrorReportMutationDiagnostics[];
	};
	persistedQueries?: ErrorReportPersistedQueryDiagnostics[];
	breadcrumbs: ErrorReportBreadcrumb[];
	context?: Record<string, ErrorReportSafeValue>;
	truncation?: {
		reason: "payload-size";
		limitBytes: number;
		originalBytes: number;
		droppedSections: string[];
	};
};

export type ErrorReportDraft = {
	reportId: string;
	sessionId: string;
	createdUtc: string;
	category: ErrorReportCategory;
	status: ErrorReportStatus;
	sentUtc?: string;
	failedReason?: string;
	payload: ErrorReportPayload;
};

/** Единственные поля draft, которые delivery lifecycle вправе изменять. */
export type ErrorReportDraftLifecyclePatch = {
	status?: ErrorReportStatus;
	sentUtc?: string;
	failedReason?: string;
};

export type ErrorReportRuntimeContext = {
	category?: Extract<ErrorReportCategory, "runtime" | "react">;
	source?: string;
	errorInfo?: ErrorReportErrorInfo;
	componentStack?: string;
	detail?: Record<string, unknown>;
};

export type ErrorReportQueryContext = {
	source?: string;
	errorInfo?: ErrorReportErrorInfo;
	queryKey?: QueryKey;
	detail?: Record<string, unknown>;
};

export type ErrorReportMutationContext = {
	source?: string;
	errorInfo?: ErrorReportErrorInfo;
	detail?: Record<string, unknown>;
};

export type ErrorReportSanitizationScope =
	| "breadcrumb-detail"
	| "context"
	| "draft-failed-reason"
	| "error-message"
	| "mutation-key"
	| "mutation-meta"
	| "persisted-query-key"
	| "query-data-shape"
	| "query-key"
	| "query-meta"
	| "stack-trace";

export type ErrorReportSanitizationContext = {
	scope: ErrorReportSanitizationScope;
	source?: string;
};

/**
 * App-level callback получает уже bounded JSON-совместимое значение и может
 * применить предметный allow-list. Foundation повторно нормализует результат,
 * поэтому callback не может обойти ограничения глубины, размера строк и циклов.
 */
export type ErrorReportSanitizer = (
	value: ErrorReportSafeValue,
	context: ErrorReportSanitizationContext
) => ErrorReportSafeValue | undefined;
