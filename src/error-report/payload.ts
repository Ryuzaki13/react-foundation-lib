import { getErrorReportCaptureOptions } from "./captureOptions";
import { createErrorReportDataPreview } from "./dataPreview";
import {
	getUtf8TextSize,
	sanitizeDetail,
	sanitizeDiagnosticText,
	sanitizeDiagnosticTextBytes,
	sanitizeErrorReportValue
} from "./safeValue";

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

const ERROR_REPORT_COMPONENT_STACK_MAX_BYTES = 32 * 1_024;
const ERROR_REPORT_SOURCE_MAX_LENGTH = 256;
const ERROR_REPORT_APPLICATION_MAX_LENGTH = 128;
const ERROR_REPORT_LOCATION_MAX_LENGTH = 2_048;

function serializedByteLength(value: unknown) {
	return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function sanitizePathname(value: string) {
	const pathname = getErrorReportCaptureOptions().valuePolicy === "verbatim" ? value : (value.split(/[?#]/, 1)[0] ?? value);
	return sanitizeDiagnosticText(pathname, ERROR_REPORT_LOCATION_MAX_LENGTH);
}

function normalizeDataPreview(preview: ErrorReportDataPreview | undefined, maxBytes: number) {
	if (!preview || maxBytes <= 0 || getErrorReportCaptureOptions().valuePolicy !== "verbatim") return undefined;
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
	context: { scope: "error-message" | "stack-trace"; source?: string },
	limit: number,
	limitUnit: "bytes" | "characters" = "characters"
) {
	const builtInValue = limitUnit === "bytes" ? sanitizeDiagnosticTextBytes(value, limit) : sanitizeDiagnosticText(value, limit);
	const sanitizedValue = sanitizeErrorReportValue(builtInValue, context, limit);
	if (typeof sanitizedValue !== "string") return undefined;
	return limitUnit === "bytes" ? sanitizeDiagnosticTextBytes(sanitizedValue, limit) : sanitizeDiagnosticText(sanitizedValue, limit);
}

function sanitizeErrorInfo(error: ErrorReportErrorInfo, source?: string): ErrorReportErrorInfo {
	const verbatim = getErrorReportCaptureOptions().valuePolicy === "verbatim";
	return {
		name: sanitizeDiagnosticText(error.name, 256),
		message:
			sanitizeScopedText(
				error.message,
				{ scope: "error-message", source },
				verbatim ? ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES : 4_096,
				verbatim ? "bytes" : "characters"
			) ?? (verbatim ? sanitizeDiagnosticTextBytes(error.message, ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES) : "[REDACTED]"),
		code: error.code ? sanitizeDiagnosticText(error.code, 128) : undefined,
		stackTrace: error.stackTrace
			? sanitizeScopedText(error.stackTrace, { scope: "stack-trace", source }, ERROR_REPORT_STACK_TRACE_MAX_BYTES, "bytes")
			: undefined,
		httpStatus: error.httpStatus
	};
}

function sanitizeQueryDiagnostics(query: ErrorReportQueryDiagnostics): ErrorReportQueryDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		...query,
		queryHash: sanitizeDiagnosticText(query.queryHash, 512),
		queryKey: sanitizeErrorReportValue(query.queryKey, {
			scope: "query-key",
			source: query.queryHash
		}) ?? { type: "redacted" },
		meta: sanitizeDetail(query.meta, { scope: "query-meta", source: query.queryHash }),
		dataShape: query.dataShape
			? sanitizeErrorReportValue(query.dataShape, { scope: "query-data-shape", source: query.queryHash })
			: undefined,
		dataPreview: normalizeDataPreview(query.dataPreview, captureOptions.dataPreviewBytes.query),
		error: query.error ? sanitizeErrorInfo(query.error, query.queryHash) : undefined
	};
}

function sanitizeMutationDiagnostics(mutation: ErrorReportMutationDiagnostics): ErrorReportMutationDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		...mutation,
		mutationKey: mutation.mutationKey ? sanitizeErrorReportValue(mutation.mutationKey, { scope: "mutation-key" }) : undefined,
		meta: sanitizeDetail(mutation.meta, { scope: "mutation-meta" }),
		variablesPreview: normalizeDataPreview(mutation.variablesPreview, captureOptions.dataPreviewBytes.mutation),
		error: mutation.error ? sanitizeErrorInfo(mutation.error, "mutation") : undefined
	};
}

function sanitizePersistedQueryDiagnostics(query: ErrorReportPersistedQueryDiagnostics): ErrorReportPersistedQueryDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		...query,
		buster: query.buster ? sanitizeDiagnosticText(query.buster, 512) : undefined,
		queryHash: query.queryHash ? sanitizeDiagnosticText(query.queryHash, 512) : undefined,
		queryKey: query.queryKey
			? sanitizeErrorReportValue(query.queryKey, {
					scope: "persisted-query-key",
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
	const verbatim = getErrorReportCaptureOptions().valuePolicy === "verbatim";
	return {
		...payload,
		reportId: sanitizeDiagnosticText(payload.reportId, 128),
		sessionId: sanitizeDiagnosticText(payload.sessionId, 128),
		createdUtc: sanitizeDiagnosticText(payload.createdUtc, 64),
		application: sanitizeDiagnosticText(payload.application, ERROR_REPORT_APPLICATION_MAX_LENGTH),
		source: sanitizeDiagnosticText(payload.source, ERROR_REPORT_SOURCE_MAX_LENGTH),
		error: sanitizeErrorInfo(payload.error, payload.source),
		environment: {
			...payload.environment,
			buildId: payload.environment.buildId ? sanitizeDiagnosticText(payload.environment.buildId, 128) : undefined
		},
		client: payload.client
			? {
					userAgent: payload.client.userAgent ? sanitizeDiagnosticText(payload.client.userAgent) : undefined,
					language: payload.client.language ? sanitizeDiagnosticText(payload.client.language, 128) : undefined,
					timeZone: payload.client.timeZone ? sanitizeDiagnosticText(payload.client.timeZone, 128) : undefined
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
						getErrorReportCaptureOptions().valuePolicy === "verbatim" && payload.location.search
							? sanitizeDiagnosticText(payload.location.search, ERROR_REPORT_LOCATION_MAX_LENGTH)
							: undefined,
					hash:
						getErrorReportCaptureOptions().valuePolicy === "verbatim" && payload.location.hash
							? sanitizeDiagnosticText(payload.location.hash, ERROR_REPORT_LOCATION_MAX_LENGTH)
							: undefined
				}
			: undefined,
		react: payload.react?.componentStack
			? {
					componentStack: sanitizeScopedText(
						payload.react.componentStack,
						{ scope: "stack-trace", source: "react-component-stack" },
						ERROR_REPORT_COMPONENT_STACK_MAX_BYTES,
						"bytes"
					)
				}
			: undefined,
		query: payload.query ? sanitizeQueryDiagnostics(payload.query) : undefined,
		mutation: payload.mutation ? sanitizeMutationDiagnostics(payload.mutation) : undefined,
		queryClient: payload.queryClient
			? {
					queries: payload.queryClient.queries.slice(-40).map(sanitizeQueryDiagnostics),
					mutations: payload.queryClient.mutations.slice(-40).map(sanitizeMutationDiagnostics),
					...(verbatim
						? {
								omittedQueries:
									(payload.queryClient.omittedQueries ?? 0) + Math.max(0, payload.queryClient.queries.length - 40) ||
									undefined,
								omittedMutations:
									(payload.queryClient.omittedMutations ?? 0) + Math.max(0, payload.queryClient.mutations.length - 40) ||
									undefined
							}
						: {})
				}
			: undefined,
		persistedQueries: payload.persistedQueries?.slice(-40).map(sanitizePersistedQueryDiagnostics),
		breadcrumbs: payload.breadcrumbs.slice(-80).map((breadcrumb) => ({
			...breadcrumb,
			utc: sanitizeDiagnosticText(breadcrumb.utc, 64),
			routeId: breadcrumb.routeId ? sanitizeDiagnosticText(breadcrumb.routeId, 512) : undefined,
			appId: breadcrumb.appId ? sanitizeDiagnosticText(breadcrumb.appId, 128) : undefined,
			viewId: breadcrumb.viewId ? sanitizeDiagnosticText(breadcrumb.viewId, 128) : undefined,
			target: breadcrumb.target ? sanitizeDiagnosticText(breadcrumb.target, 2_048) : undefined,
			detail: sanitizeDetail(breadcrumb.detail, {
				scope: "breadcrumb-detail",
				source: breadcrumb.type
			})
		})),
		context: sanitizeDetail(payload.context, { scope: "context", source: payload.source })
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
			reason: "payload-size",
			limitBytes: ERROR_REPORT_PAYLOAD_MAX_BYTES,
			originalBytes,
			droppedSections
		}
	};

	if (getErrorReportCaptureOptions().valuePolicy === "verbatim") {
		for (const previewLimit of [512, 128, 4]) {
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

	if (getErrorReportCaptureOptions().valuePolicy === "verbatim") {
		drop(
			"queryClient.queries:oldest",
			(current) => (current.queryClient?.queries.length ?? 0) > 10,
			(current) => ({
				...current,
				queryClient: current.queryClient
					? {
							...current.queryClient,
							queries: current.queryClient.queries.slice(-10),
							omittedQueries: (current.queryClient.omittedQueries ?? 0) + current.queryClient.queries.length - 10
						}
					: undefined
			})
		);
		drop(
			"queryClient.mutations:oldest",
			(current) => (current.queryClient?.mutations.length ?? 0) > 10,
			(current) => ({
				...current,
				queryClient: current.queryClient
					? {
							...current.queryClient,
							mutations: current.queryClient.mutations.slice(-10),
							omittedMutations: (current.queryClient.omittedMutations ?? 0) + current.queryClient.mutations.length - 10
						}
					: undefined
			})
		);
		drop(
			"persistedQueries:oldest",
			(current) => (current.persistedQueries?.length ?? 0) > 10,
			(current) => ({ ...current, persistedQueries: current.persistedQueries?.slice(-10) })
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
		(current) => current.breadcrumbs.length > 20,
		(current) => ({
			...current,
			breadcrumbs: current.breadcrumbs.slice(-20)
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
