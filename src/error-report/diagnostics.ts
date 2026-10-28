import { type PersistedQuery } from "@tanstack/query-persist-client-core";
import { type MutationKey, type MutationState, type QueryClient, type QueryKey, type QueryState } from "@tanstack/react-query";

import { hashString128 } from "../crypto";
import { createIndexedDbQueryStorage } from "../query-client";
import { stableStringify } from "../utils";

import { getErrorReportCaptureOptions } from "./captureOptions";
import { ERROR_REPORT_VALUE_POLICY_VERBATIM } from "./capturePolicyConstants";
import { createErrorReportDataPreview } from "./dataPreview";
import { createErrorInfo } from "./errorInfo";
import {
	ERROR_REPORT_PERSISTENCE_BUSTER_MAX_LENGTH,
	ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_PERSISTED_DIAGNOSTICS_MAX_ITEMS
} from "./errorReportCaptureLimits";
import {
	ERROR_REPORT_SCOPE_MUTATION_META,
	ERROR_REPORT_SCOPE_QUERY_META,
	ERROR_REPORT_SCOPE_QUERY_KEY,
	ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE,
	ERROR_REPORT_SCOPE_MUTATION_KEY,
	ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY
} from "./errorReportContractConstants";
import { canUseErrorReportBrowserStorage } from "./errorReportStorage";
import { createDataShape, sanitizeDetail, sanitizeDiagnosticText, sanitizeErrorReportValue } from "./safeValue";
import { SAFE_VALUE_TYPE_REDACTED } from "./safeValueMarkerConstants";
import {
	type ErrorReportMutationDiagnostics,
	type ErrorReportPersistedQueryDiagnostics,
	type ErrorReportQueryDiagnostics,
	type ErrorReportSafeValue
} from "./types";

type QueryDiagnosticSource = {
	queryHash: string;
	queryKey: QueryKey;
	state: QueryState<unknown, unknown>;
	meta?: Record<string, unknown>;
	getObserversCount: () => number;
};

type MutationDiagnosticSource = {
	options: {
		mutationKey?: MutationKey;
	};
	state: MutationState<unknown, unknown, unknown, unknown>;
	meta?: Record<string, unknown>;
};

function sanitizeMeta(
	meta: Record<string, unknown> | undefined,
	scope: typeof ERROR_REPORT_SCOPE_MUTATION_META | typeof ERROR_REPORT_SCOPE_QUERY_META,
	source?: string
): Record<string, ErrorReportSafeValue> | undefined {
	return sanitizeDetail(meta, { scope, source });
}

export function collectQueryDiagnostics(query: QueryDiagnosticSource): ErrorReportQueryDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	const queryKey = sanitizeErrorReportValue(query.queryKey, { scope: ERROR_REPORT_SCOPE_QUERY_KEY }) ?? {
		type: SAFE_VALUE_TYPE_REDACTED
	};
	const queryHash =
		captureOptions.valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM
			? hashString128(query.queryHash)
			: hashString128(stableStringify(queryKey));

	return {
		queryHash,
		queryKey,
		status: query.state.status,
		fetchStatus: query.state.fetchStatus,
		dataUpdatedAt: query.state.dataUpdatedAt,
		errorUpdatedAt: query.state.errorUpdatedAt,
		failureCount: query.state.fetchFailureCount,
		isInvalidated: query.state.isInvalidated,
		observersCount: query.getObserversCount(),
		meta: sanitizeMeta(query.meta, ERROR_REPORT_SCOPE_QUERY_META, queryHash),
		dataShape: sanitizeErrorReportValue(createDataShape(query.state.data), {
			scope: ERROR_REPORT_SCOPE_QUERY_DATA_SHAPE,
			source: queryHash
		}),
		dataPreview:
			captureOptions.valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM &&
			captureOptions.dataPreviewBytes.query > 0 &&
			query.state.data !== undefined
				? createErrorReportDataPreview(query.state.data, captureOptions.dataPreviewBytes.query)
				: undefined,
		error: query.state.error ? createErrorInfo(query.state.error) : undefined
	};
}

export function collectMutationDiagnostics(mutation: MutationDiagnosticSource): ErrorReportMutationDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	return {
		mutationKey: mutation.options.mutationKey
			? sanitizeErrorReportValue(mutation.options.mutationKey, { scope: ERROR_REPORT_SCOPE_MUTATION_KEY })
			: undefined,
		status: mutation.state.status,
		failureCount: mutation.state.failureCount,
		submittedAt: mutation.state.submittedAt,
		meta: sanitizeMeta(mutation.meta, ERROR_REPORT_SCOPE_MUTATION_META),
		variablesPreview:
			captureOptions.valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM &&
			captureOptions.dataPreviewBytes.mutation > 0 &&
			mutation.state.variables !== undefined
				? createErrorReportDataPreview(mutation.state.variables, captureOptions.dataPreviewBytes.mutation)
				: undefined,
		error: mutation.state.error ? createErrorInfo(mutation.state.error) : undefined
	};
}

export function collectQueryClientDiagnostics(queryClient: QueryClient) {
	const queries = queryClient.getQueryCache().getAll();
	const mutations = queryClient.getMutationCache().getAll();
	return {
		queries: queries.slice(-ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS).map(collectQueryDiagnostics),
		mutations: mutations.slice(-ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS).map(collectMutationDiagnostics),
		...(getErrorReportCaptureOptions().valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM
			? {
					omittedQueries: Math.max(0, queries.length - ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS) || undefined,
					omittedMutations: Math.max(0, mutations.length - ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS) || undefined
				}
			: {})
	};
}

function collectPersistedStateDiagnostics(persistedQuery: PersistedQuery): ErrorReportPersistedQueryDiagnostics {
	const captureOptions = getErrorReportCaptureOptions();
	const state = persistedQuery.state;
	const queryKey = sanitizeErrorReportValue(persistedQuery.queryKey, { scope: ERROR_REPORT_SCOPE_PERSISTED_QUERY_KEY });
	const queryHash =
		captureOptions.valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM
			? hashString128(persistedQuery.queryHash)
			: queryKey
				? hashString128(stableStringify(queryKey))
				: undefined;

	return {
		buster: persistedQuery.buster
			? sanitizeDiagnosticText(persistedQuery.buster, ERROR_REPORT_PERSISTENCE_BUSTER_MAX_LENGTH)
			: undefined,
		queryHash,
		queryKey,
		status: state.status,
		fetchStatus: state.fetchStatus,
		dataUpdatedAt: state.dataUpdatedAt,
		errorUpdatedAt: state.errorUpdatedAt,
		failureCount: state.fetchFailureCount,
		dataPreview:
			captureOptions.valuePolicy === ERROR_REPORT_VALUE_POLICY_VERBATIM &&
			captureOptions.dataPreviewBytes.persistedQuery > 0 &&
			state.data !== undefined
				? createErrorReportDataPreview(state.data, captureOptions.dataPreviewBytes.persistedQuery)
				: undefined,
		error: state.error ? createErrorInfo(state.error) : undefined
	};
}

/**
 * Читает IndexedDB persistence. Данные кэша попадают в результат только при
 * явном включении ограниченных previews приложением.
 */
export async function collectPersistedQueryDiagnostics(): Promise<ErrorReportPersistedQueryDiagnostics[]> {
	if (!canUseErrorReportBrowserStorage()) return [];

	const storage = createIndexedDbQueryStorage<PersistedQuery>();
	if (!storage?.entries) return [];

	try {
		const entries = await storage.entries();
		// Уже начатую IDB operation не отменяем, но после opt-out её результат
		// больше не является доступным источником диагностики этого документа.
		if (!canUseErrorReportBrowserStorage()) return [];
		return entries
			.slice(-ERROR_REPORT_PERSISTED_DIAGNOSTICS_MAX_ITEMS)
			.map(([, persistedQuery]) => collectPersistedStateDiagnostics(persistedQuery));
	} catch {
		return [];
	}
}
