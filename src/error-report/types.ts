import {
	type ERROR_REPORT_CATEGORY_QUERY,
	type ERROR_REPORT_CATEGORY_MUTATION,
	type ERROR_REPORT_CATEGORY_RUNTIME,
	type ERROR_REPORT_CATEGORY_REACT,
	type ERROR_REPORT_STATUS_PENDING,
	type ERROR_REPORT_STATUS_SENDING,
	type ERROR_REPORT_STATUS_SENT,
	type ERROR_REPORT_STATUS_FAILED,
	type ERROR_REPORT_BREADCRUMB_ROUTE,
	type ERROR_REPORT_BREADCRUMB_CLICK,
	type ERROR_REPORT_BREADCRUMB_VISIBILITY,
	type ERROR_REPORT_BREADCRUMB_QUERY_ERROR,
	type ERROR_REPORT_BREADCRUMB_MUTATION_ERROR,
	type ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR,
	type ERROR_REPORT_MODE_DEVELOPMENT,
	type ERROR_REPORT_MODE_PRODUCTION,
	type ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE,
	type ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL,
	type ERROR_REPORT_SCOPE_CONTEXT,
	type ERROR_REPORT_SCOPE_DRAFT_FAILED_REASON,
	type ERROR_REPORT_SCOPE_ERROR_MESSAGE,
	type ERROR_REPORT_SCOPE_MUTATION_KEY,
	type ERROR_REPORT_SCOPE_MUTATION_META,
	type ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY,
	type ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE,
	type ERROR_REPORT_SCOPE_QUERY_KEY,
	type ERROR_REPORT_SCOPE_QUERY_META,
	type ERROR_REPORT_SCOPE_STACK_TRACE
} from "./errorReportContractConstants";
import { type ERROR_REPORT_PAYLOAD_VERSION } from "./payload";

import type { QueryKey } from "@tanstack/react-query";

export type ErrorReportCategory =
	| typeof ERROR_REPORT_CATEGORY_QUERY
	| typeof ERROR_REPORT_CATEGORY_MUTATION
	| typeof ERROR_REPORT_CATEGORY_RUNTIME
	| typeof ERROR_REPORT_CATEGORY_REACT;

export type ErrorReportStatus =
	| typeof ERROR_REPORT_STATUS_PENDING
	| typeof ERROR_REPORT_STATUS_SENDING
	| typeof ERROR_REPORT_STATUS_SENT
	| typeof ERROR_REPORT_STATUS_FAILED;

export type ErrorReportPayloadVersion = typeof ERROR_REPORT_PAYLOAD_VERSION;

export type ErrorReportSafeValue = string | number | boolean | null | ErrorReportSafeValue[] | { [key: string]: ErrorReportSafeValue };

/** Ограниченный валидный JSON-снимок данных; `truncated` отмечает утрату хвоста. */
export type ErrorReportDataPreview = {
	json: string;
	truncated: boolean;
};

export type ErrorReportErrorInfo = {
	name: string;
	message: string;
	code?: string;
	stackTrace?: string;
	httpStatus?: number;
};

export type ErrorReportBreadcrumb = {
	utc: string;
	type:
		| typeof ERROR_REPORT_BREADCRUMB_ROUTE
		| typeof ERROR_REPORT_BREADCRUMB_CLICK
		| typeof ERROR_REPORT_BREADCRUMB_VISIBILITY
		| typeof ERROR_REPORT_BREADCRUMB_QUERY_ERROR
		| typeof ERROR_REPORT_BREADCRUMB_MUTATION_ERROR
		| typeof ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR;
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
	dataPreview?: ErrorReportDataPreview;
	error?: ErrorReportErrorInfo;
};

export type ErrorReportMutationDiagnostics = {
	mutationKey?: ErrorReportSafeValue;
	status?: string;
	failureCount?: number;
	submittedAt?: number;
	meta?: Record<string, ErrorReportSafeValue>;
	variablesPreview?: ErrorReportDataPreview;
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
	dataPreview?: ErrorReportDataPreview;
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
		mode: typeof ERROR_REPORT_MODE_DEVELOPMENT | typeof ERROR_REPORT_MODE_PRODUCTION;
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
		search?: string;
		hash?: string;
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
		omittedQueries?: number;
		omittedMutations?: number;
	};
	persistedQueries?: ErrorReportPersistedQueryDiagnostics[];
	breadcrumbs: ErrorReportBreadcrumb[];
	context?: Record<string, ErrorReportSafeValue>;
	truncation?: {
		reason: typeof ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE;
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
	category?: Extract<ErrorReportCategory, typeof ERROR_REPORT_CATEGORY_RUNTIME | typeof ERROR_REPORT_CATEGORY_REACT>;
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
	| typeof ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL
	| typeof ERROR_REPORT_SCOPE_CONTEXT
	| typeof ERROR_REPORT_SCOPE_DRAFT_FAILED_REASON
	| typeof ERROR_REPORT_SCOPE_ERROR_MESSAGE
	| typeof ERROR_REPORT_SCOPE_MUTATION_KEY
	| typeof ERROR_REPORT_SCOPE_MUTATION_META
	| typeof ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY
	| typeof ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE
	| typeof ERROR_REPORT_SCOPE_QUERY_KEY
	| typeof ERROR_REPORT_SCOPE_QUERY_META
	| typeof ERROR_REPORT_SCOPE_STACK_TRACE;

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
