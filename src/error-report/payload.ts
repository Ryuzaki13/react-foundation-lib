import { getErrorReportCaptureOptions } from "./captureOptions";
import { ERROR_REPORT_VALUE_POLICY_VERBATIM } from "./capturePolicyConstants";
import { createErrorReportDataPreview } from "./dataPreview";
import {
	ERROR_REPORT_ERROR_NAME_MAX_LENGTH,
	ERROR_REPORT_ERROR_CODE_MAX_LENGTH,
	ERROR_REPORT_UTC_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_ROUTE_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_APP_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_VIEW_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_TARGET_MAX_LENGTH,
	ERROR_REPORT_QUERY_HASH_MAX_LENGTH,
	ERROR_REPORT_PERSISTENCE_BUSTER_MAX_LENGTH,
	ERROR_REPORT_APPLICATION_MAX_LENGTH,
	ERROR_REPORT_SOURCE_MAX_LENGTH,
	ERROR_REPORT_BUILD_ID_MAX_LENGTH,
	ERROR_REPORT_LANGUAGE_MAX_LENGTH,
	ERROR_REPORT_TIME_ZONE_MAX_LENGTH,
	ERROR_REPORT_LOCATION_MAX_LENGTH,
	ERROR_REPORT_COMPONENT_STACK_MAX_BYTES,
	ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_PERSISTED_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_BREADCRUMBS_MAX_ITEMS
} from "./errorReportCaptureLimits";
import {
	ERROR_REPORT_SCOPE_ERROR_MESSAGE,
	ERROR_REPORT_SCOPE_STACK_TRACE,
	ERROR_REPORT_SCOPE_QUERY_KEY,
	ERROR_REPORT_SCOPE_QUERY_META,
	ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE,
	ERROR_REPORT_SCOPE_MUTATION_KEY,
	ERROR_REPORT_SCOPE_MUTATION_META,
	ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY,
	ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL,
	ERROR_REPORT_SCOPE_CONTEXT,
	ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE,
	ERROR_REPORT_SOURCE_MUTATION
} from "./errorReportContractConstants";
import {
	getUtf8TextSize,
	sanitizeDetail,
	sanitizeDiagnosticText,
	sanitizeDiagnosticTextBytes,
	sanitizeErrorReportValue
} from "./safeValue";
import { REDACTED_VALUE, SAFE_VALUE_TYPE_REDACTED } from "./safeValueMarkerConstants";

import type {
	ErrorReportErrorInfo,
	ErrorReportDataPreview,
	ErrorReportMutationDiagnostics,
	ErrorReportPayload,
	ErrorReportPersistedQueryDiagnostics,
	ErrorReportQueryDiagnostics
} from "./types";

export const ERROR_REPORT_PAYLOAD_VERSION = 1 as const;
export const ERROR_REPORT_PAYLOAD_MAX_BYTES = 256 * 1_024;
export const ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES = 128 * 1_024;
export const ERROR_REPORT_STACK_TRACE_MAX_BYTES = 64 * 1_024;

const REPORT_ID_MAX_LENGTH = 128;
const SESSION_ID_MAX_LENGTH = 128;
const REDACTED_MESSAGE_MAX_LENGTH = 4_096;
const REDUCED_QUERIES_MAX_ITEMS = 10;
const REDUCED_MUTATIONS_MAX_ITEMS = 10;
const REDUCED_PERSISTED_QUERIES_MAX_ITEMS = 10;
const REDUCED_BREADCRUMBS_MAX_ITEMS = 20;
const REDUCED_PREVIEW_BYTE_LIMITS = [512, 128, 4];

const TEXT_LIMIT_BYTES = "bytes";
const TEXT_LIMIT_CHARACTERS = "characters";

function serializedByteLength(value: unknown) {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function sanitizePathname(value: string) {
	const pathname =
		getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM ? value : (value.split(/[?#]/, 1)[0] ?? value);
	return sanitizeDiagnosticText(pathname, ERROR_REPORT_LOCATION_MAX_LENGTH);
}

function normalizeDataPreview(preview: ErrorReportDataPreview | undefined, maxBytes: number) {
	if (!preview || maxBytes <= 0 || getErrorReportCaptureOptions().valuePolicy !== ERROR_REPORT_VALUE_POLICY_VERBATIM) return undefined;
	try {
		const value: unknown = JSON.parse(preview.json);
		if (getUtf8TextSize(preview.json) <= maxBytes) return preview;
		const reduced = createErrorReportDataPreview(value, maxBytes);
		return { ...reduced, truncated: true };
	} catch {
		return undefined;
	}
}

function sanitizeScopedText(
	value: string,
	context: { scope: typeof ERROR_REPORT_SCOPE_ERROR_MESSAGE | typeof ERROR_REPORT_SCOPE_STACK_TRACE; source?: string },
	limit: number,
	limitUnit: typeof TEXT_LIMIT_BYTES | typeof TEXT_LIMIT_CHARACTERS = TEXT_LIMIT_CHARACTERS
) {
	const builtInValue = limitUnit === TEXT_LIMIT_BYTES ? sanitizeDiagnosticTextBytes(value, limit) : sanitizeDiagnosticText(value, limit);
	const sanitizedValue = sanitizeErrorReportValue(builtInValue, context, limit);
	if (typeof sanitizedValue !== "string") return undefined;
	return limitUnit === TEXT_LIMIT_BYTES
		? sanitizeDiagnosticTextBytes(sanitizedValue, limit)
		: sanitizeDiagnosticText(sanitizedValue, limit);
}

function sanitizeErrorInfo(error: ErrorReportErrorInfo, source?: string): ErrorReportErrorInfo {
	const verbatim = getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM;
	return {
		name: sanitizeDiagnosticText(error.name, ERROR_REPORT_ERROR_NAME_MAX_LENGTH),
		message:
			sanitizeScopedText(
				error.message,
				{ scope: ERROR_REPORT_SCOPE_ERROR_MESSAGE, source },
				verbatim ? ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES : REDACTED_MESSAGE_MAX_LENGTH,
				verbatim ? TEXT_LIMIT_BYTES : TEXT_LIMIT_CHARACTERS
			) ?? (verbatim ? sanitizeDiagnosticTextBytes(error.message, ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES) : REDACTED_VALUE),
		code: error.code ? sanitizeDiagnosticText(error.code, ERROR_REPORT_ERROR_CODE_MAX_LENGTH) : undefined,
		stackTrace: error.stackTrace
			? sanitizeScopedText(
					error.stackTrace,
					{ scope: ERROR_REPORT_SCOPE_STACK_TRACE, source },
					ERROR_REPORT_STACK_TRACE_MAX_BYTES,
					TEXT_LIMIT_BYTES
				)
			: undefined,
		httpStatus: error.httpStatus
	};
}

function sanitizeQueryDiagnostics(query: ErrorReportQueryDiagnostics): ErrorReportQueryDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		...query,
		queryHash: sanitizeDiagnosticText(query.queryHash, ERROR_REPORT_QUERY_HASH_MAX_LENGTH),
		queryKey: sanitizeErrorReportValue(query.queryKey, {
			scope: ERROR_REPORT_SCOPE_QUERY_KEY,
			source: query.queryHash
		}) ?? { type: SAFE_VALUE_TYPE_REDACTED },
		meta: sanitizeDetail(query.meta, { scope: ERROR_REPORT_SCOPE_QUERY_META, source: query.queryHash }),
		dataShape: query.dataShape
			? sanitizeErrorReportValue(query.dataShape, { scope: ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE, source: query.queryHash })
			: undefined,
		dataPreview: normalizeDataPreview(query.dataPreview, captureOptions.dataPreviewBytes.query),
		error: query.error ? sanitizeErrorInfo(query.error, query.queryHash) : undefined
	};
}

function sanitizeMutationDiagnostics(mutation: ErrorReportMutationDiagnostics): ErrorReportMutationDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		...mutation,
		mutationKey: mutation.mutationKey
			? sanitizeErrorReportValue(mutation.mutationKey, { scope: ERROR_REPORT_SCOPE_MUTATION_KEY })
			: undefined,
		meta: sanitizeDetail(mutation.meta, { scope: ERROR_REPORT_SCOPE_MUTATION_META }),
		variablesPreview: normalizeDataPreview(mutation.variablesPreview, captureOptions.dataPreviewBytes.mutation),
		error: mutation.error ? sanitizeErrorInfo(mutation.error, ERROR_REPORT_SOURCE_MUTATION) : undefined
	};
}

function sanitizePersistedQueryDiagnostics(query: ErrorReportPersistedQueryDiagnostics): ErrorReportPersistedQueryDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		...query,
		buster: query.buster ? sanitizeDiagnosticText(query.buster, ERROR_REPORT_PERSISTENCE_BUSTER_MAX_LENGTH) : undefined,
		queryHash: query.queryHash ? sanitizeDiagnosticText(query.queryHash, ERROR_REPORT_QUERY_HASH_MAX_LENGTH) : undefined,
		queryKey: query.queryKey
			? sanitizeErrorReportValue(query.queryKey, {
					scope: ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY,
					source: query.queryHash
				})
			: undefined,
		dataPreview: normalizeDataPreview(query.dataPreview, captureOptions.dataPreviewBytes.persistedQuery),
		error: query.error ? sanitizeErrorInfo(query.error, query.queryHash) : undefined
	};
}

/** Возвращает точный UTF-8 размер JSON-формы, которую получит transport. */
export function getErrorReportPayloadSize(payload: ErrorReportPayload) {
	return serializedByteLength(payload);
}

function normalizePayloadStrings(payload: ErrorReportPayload): ErrorReportPayload {
	const verbatim = getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM;
	return {
		...payload,
		reportId: sanitizeDiagnosticText(payload.reportId, REPORT_ID_MAX_LENGTH),
		sessionId: sanitizeDiagnosticText(payload.sessionId, SESSION_ID_MAX_LENGTH),
		createdUtc: sanitizeDiagnosticText(payload.createdUtc, ERROR_REPORT_UTC_MAX_LENGTH),
		application: sanitizeDiagnosticText(payload.application, ERROR_REPORT_APPLICATION_MAX_LENGTH),
		source: sanitizeDiagnosticText(payload.source, ERROR_REPORT_SOURCE_MAX_LENGTH),
		error: sanitizeErrorInfo(payload.error, payload.source),
		environment: {
			...payload.environment,
			buildId: payload.environment.buildId
				? sanitizeDiagnosticText(payload.environment.buildId, ERROR_REPORT_BUILD_ID_MAX_LENGTH)
				: undefined
		},
		client: payload.client
			? {
					userAgent: payload.client.userAgent ? sanitizeDiagnosticText(payload.client.userAgent) : undefined,
					language: payload.client.language
						? sanitizeDiagnosticText(payload.client.language, ERROR_REPORT_LANGUAGE_MAX_LENGTH)
						: undefined,
					timeZone: payload.client.timeZone
						? sanitizeDiagnosticText(payload.client.timeZone, ERROR_REPORT_TIME_ZONE_MAX_LENGTH)
						: undefined
				}
			: undefined,
		location: payload.location
			? {
					pathname: sanitizePathname(payload.location.pathname),
					origin: payload.location.origin
						? sanitizeDiagnosticText(
								payload.location.origin.split(/[?#]/, 1)[0] ?? payload.location.origin,
								ERROR_REPORT_LOCATION_MAX_LENGTH
							)
						: undefined,
					search:
						getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM && payload.location.search
							? sanitizeDiagnosticText(payload.location.search, ERROR_REPORT_LOCATION_MAX_LENGTH)
							: undefined,
					hash:
						getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM && payload.location.hash
							? sanitizeDiagnosticText(payload.location.hash, ERROR_REPORT_LOCATION_MAX_LENGTH)
							: undefined
				}
			: undefined,
		react: payload.react?.componentStack
			? {
					componentStack: sanitizeScopedText(
						payload.react.componentStack,
						{ scope: ERROR_REPORT_SCOPE_STACK_TRACE, source: "react-component-stack" },
						ERROR_REPORT_COMPONENT_STACK_MAX_BYTES,
						TEXT_LIMIT_BYTES
					)
				}
			: undefined,
		query: payload.query ? sanitizeQueryDiagnostics(payload.query) : undefined,
		mutation: payload.mutation ? sanitizeMutationDiagnostics(payload.mutation) : undefined,
		queryClient: payload.queryClient
			? {
					queries: payload.queryClient.queries.slice(-ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS).map(sanitizeQueryDiagnostics),
					mutations: payload.queryClient.mutations
						.slice(-ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS)
						.map(sanitizeMutationDiagnostics),
					...(verbatim
						? {
								omittedQueries:
									(payload.queryClient.omittedQueries ?? 0) +
										Math.max(0, payload.queryClient.queries.length - ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS) ||
									undefined,
								omittedMutations:
									(payload.queryClient.omittedMutations ?? 0) +
										Math.max(0, payload.queryClient.mutations.length - ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS) ||
									undefined
							}
						: {})
				}
			: undefined,
		persistedQueries: payload.persistedQueries
			?.slice(-ERROR_REPORT_PERSISTED_DIAGNOSTICS_MAX_ITEMS)
			.map(sanitizePersistedQueryDiagnostics),
		breadcrumbs: payload.breadcrumbs.slice(-ERROR_REPORT_BREADCRUMBS_MAX_ITEMS).map((breadcrumb) => ({
			...breadcrumb,
			utc: sanitizeDiagnosticText(breadcrumb.utc, ERROR_REPORT_UTC_MAX_LENGTH),
			routeId: breadcrumb.routeId ? sanitizeDiagnosticText(breadcrumb.routeId, ERROR_REPORT_BREADCRUMB_ROUTE_MAX_LENGTH) : undefined,
			appId: breadcrumb.appId ? sanitizeDiagnosticText(breadcrumb.appId, ERROR_REPORT_BREADCRUMB_APP_MAX_LENGTH) : undefined,
			viewId: breadcrumb.viewId ? sanitizeDiagnosticText(breadcrumb.viewId, ERROR_REPORT_BREADCRUMB_VIEW_MAX_LENGTH) : undefined,
			target: breadcrumb.target ? sanitizeDiagnosticText(breadcrumb.target, ERROR_REPORT_BREADCRUMB_TARGET_MAX_LENGTH) : undefined,
			detail: sanitizeDetail(breadcrumb.detail, {
				scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL,
				source: breadcrumb.type
			})
		})),
		context: sanitizeDetail(payload.context, { scope: ERROR_REPORT_SCOPE_CONTEXT, source: payload.source })
	};
}

function reducePreview(preview: ErrorReportDataPreview | undefined, maxBytes: number) {
	if (!preview || getUtf8TextSize(preview.json) <= maxBytes) return preview;
	try {
		const value: unknown = JSON.parse(preview.json);
		const reduced = createErrorReportDataPreview(value, maxBytes);
		return { ...reduced, truncated: true };
	} catch {
		return { json: "null", truncated: true };
	}
}

/**
 * Сначала уменьшаем тяжёлые значения кэша, сохраняя ключи, статусы и ошибки.
 * Основные query/mutation отчёта сокращаются только после фонового снимка.
 */
function reduceDataPreviews(payload: ErrorReportPayload, maxBytes: number, background: boolean): ErrorReportPayload {
	if (background) {
		return {
			...payload,
			queryClient: payload.queryClient
				? {
						...payload.queryClient,
						queries: payload.queryClient.queries.map((query) => ({
							...query,
							dataPreview: reducePreview(query.dataPreview, maxBytes)
						})),
						mutations: payload.queryClient.mutations.map((mutation) => ({
							...mutation,
							variablesPreview: reducePreview(mutation.variablesPreview, maxBytes)
						}))
					}
				: undefined,
			persistedQueries: payload.persistedQueries?.map((query) => ({
				...query,
				dataPreview: reducePreview(query.dataPreview, maxBytes)
			}))
		};
	}

	return {
		...payload,
		query: payload.query ? { ...payload.query, dataPreview: reducePreview(payload.query.dataPreview, maxBytes) } : undefined,
		mutation: payload.mutation
			? { ...payload.mutation, variablesPreview: reducePreview(payload.mutation.variablesPreview, maxBytes) }
			: undefined
	};
}

/**
 * Удаляет диагностические секции в фиксированном порядке, пока payload не
 * помещается в transport/storage limit. Identity, классификация и ошибка
 * сохраняются всегда; маркер перечисляет каждую фактически удалённую секцию.
 */
export function limitErrorReportPayload(input: ErrorReportPayload): ErrorReportPayload {
	const normalized = normalizePayloadStrings(input);
	const originalBytes = getErrorReportPayloadSize(normalized);
	if (originalBytes <= ERROR_REPORT_PAYLOAD_MAX_BYTES) return normalized;

	const droppedSections: string[] = [];
	let payload: ErrorReportPayload = {
		...normalized,
		truncation: {
			reason: ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE,
			limitBytes: ERROR_REPORT_PAYLOAD_MAX_BYTES,
			originalBytes,
			droppedSections
		}
	};

	if (getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM) {
		for (const previewLimit of REDUCED_PREVIEW_BYTE_LIMITS) {
			if (getErrorReportPayloadSize(payload) <= ERROR_REPORT_PAYLOAD_MAX_BYTES) break;
			payload = reduceDataPreviews(payload, previewLimit, true);
			if (getErrorReportPayloadSize(payload) <= ERROR_REPORT_PAYLOAD_MAX_BYTES) break;
			payload = reduceDataPreviews(payload, previewLimit, false);
		}
	}

	const drop = (
		section: string,
		isPresent: (current: ErrorReportPayload) => boolean,
		update: (current: ErrorReportPayload) => ErrorReportPayload
	) => {
		if (!isPresent(payload) || getErrorReportPayloadSize(payload) <= ERROR_REPORT_PAYLOAD_MAX_BYTES) return;
		droppedSections.push(section);
		payload = update(payload);
	};

	if (getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM) {
		drop(
			"queryClient.queries:oldest",
			(current) => (current.queryClient?.queries.length ?? 0) > REDUCED_QUERIES_MAX_ITEMS,
			(current) => ({
				...current,
				queryClient: current.queryClient
					? {
							...current.queryClient,
							queries: current.queryClient.queries.slice(-REDUCED_QUERIES_MAX_ITEMS),
							omittedQueries:
								(current.queryClient.omittedQueries ?? 0) + current.queryClient.queries.length - REDUCED_QUERIES_MAX_ITEMS
						}
					: undefined
			})
		);
		drop(
			"queryClient.mutations:oldest",
			(current) => (current.queryClient?.mutations.length ?? 0) > REDUCED_MUTATIONS_MAX_ITEMS,
			(current) => ({
				...current,
				queryClient: current.queryClient
					? {
							...current.queryClient,
							mutations: current.queryClient.mutations.slice(-REDUCED_MUTATIONS_MAX_ITEMS),
							omittedMutations:
								(current.queryClient.omittedMutations ?? 0) +
								current.queryClient.mutations.length -
								REDUCED_MUTATIONS_MAX_ITEMS
						}
					: undefined
			})
		);
		drop(
			"persistedQueries:oldest",
			(current) => (current.persistedQueries?.length ?? 0) > REDUCED_PERSISTED_QUERIES_MAX_ITEMS,
			(current) => ({ ...current, persistedQueries: current.persistedQueries?.slice(-REDUCED_PERSISTED_QUERIES_MAX_ITEMS) })
		);
	}
	drop(
		"queryClient",
		(current) => current.queryClient !== undefined,
		(current) => ({ ...current, queryClient: undefined })
	);
	drop(
		"persistedQueries",
		(current) => current.persistedQueries !== undefined,
		(current) => ({ ...current, persistedQueries: undefined })
	);
	drop(
		"context",
		(current) => current.context !== undefined,
		(current) => ({ ...current, context: undefined })
	);
	drop(
		"query.meta",
		(current) => current.query?.meta !== undefined,
		(current) => ({
			...current,
			query: current.query ? { ...current.query, meta: undefined } : undefined
		})
	);
	drop(
		"query.dataShape",
		(current) => current.query?.dataShape !== undefined,
		(current) => ({
			...current,
			query: current.query ? { ...current.query, dataShape: undefined } : undefined
		})
	);
	drop(
		"mutation.meta",
		(current) => current.mutation?.meta !== undefined,
		(current) => ({
			...current,
			mutation: current.mutation ? { ...current.mutation, meta: undefined } : undefined
		})
	);
	drop(
		"breadcrumbs:oldest",
		(current) => current.breadcrumbs.length > REDUCED_BREADCRUMBS_MAX_ITEMS,
		(current) => ({
			...current,
			breadcrumbs: current.breadcrumbs.slice(-REDUCED_BREADCRUMBS_MAX_ITEMS)
		})
	);
	drop(
		"query",
		(current) => current.query !== undefined,
		(current) => ({ ...current, query: undefined })
	);
	drop(
		"mutation",
		(current) => current.mutation !== undefined,
		(current) => ({ ...current, mutation: undefined })
	);
	drop(
		"react",
		(current) => current.react !== undefined,
		(current) => ({ ...current, react: undefined })
	);
	drop(
		"breadcrumbs",
		(current) => current.breadcrumbs.length > 0,
		(current) => ({ ...current, breadcrumbs: [] })
	);
	drop(
		"client",
		(current) => current.client !== undefined,
		(current) => ({ ...current, client: undefined })
	);
	drop(
		"viewport",
		(current) => current.viewport !== undefined,
		(current) => ({ ...current, viewport: undefined })
	);

	return payload;
}
