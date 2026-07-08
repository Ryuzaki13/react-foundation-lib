import { type PersistedQuery } from "@tanstack/query-persist-client-core";
import { type MutationKey, type MutationState, type QueryClient, type QueryKey, type QueryState } from "@tanstack/react-query";

import { createIndexedDbQueryStorage } from "../query-client";

import { createErrorInfo } from "./errorInfo";
import { createDataShape, createDiagnosticValue, sanitizeDetail } from "./safeValue";
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

const MAX_QUERY_DIAGNOSTICS = 40;
const MAX_MUTATION_DIAGNOSTICS = 40;
const MAX_PERSISTED_QUERY_DIAGNOSTICS = 40;

function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, ErrorReportSafeValue> | undefined {
	return sanitizeDetail(meta);
}

export function collectQueryDiagnostics(query: QueryDiagnosticSource): ErrorReportQueryDiagnostics {
	return {
		queryHash: query.queryHash,
		queryKey: createDiagnosticValue(query.queryKey),
		status: query.state.status,
		fetchStatus: query.state.fetchStatus,
		dataUpdatedAt: query.state.dataUpdatedAt,
		errorUpdatedAt: query.state.errorUpdatedAt,
		failureCount: query.state.fetchFailureCount,
		isInvalidated: query.state.isInvalidated,
		observersCount: query.getObserversCount(),
		meta: sanitizeMeta(query.meta),
		dataShape: createDataShape(query.state.data),
		error: query.state.error ? createErrorInfo(query.state.error) : undefined
	};
}

export function collectMutationDiagnostics(mutation: MutationDiagnosticSource): ErrorReportMutationDiagnostics {
	return {
		mutationKey: mutation.options.mutationKey ? createDiagnosticValue(mutation.options.mutationKey) : undefined,
		status: mutation.state.status,
		failureCount: mutation.state.failureCount,
		submittedAt: mutation.state.submittedAt,
		meta: sanitizeMeta(mutation.meta),
		error: mutation.state.error ? createErrorInfo(mutation.state.error) : undefined
	};
}

export function collectQueryClientDiagnostics(queryClient: QueryClient) {
	return {
		queries: queryClient.getQueryCache().getAll().slice(-MAX_QUERY_DIAGNOSTICS).map(collectQueryDiagnostics),
		mutations: queryClient.getMutationCache().getAll().slice(-MAX_MUTATION_DIAGNOSTICS).map(collectMutationDiagnostics)
	};
}

function collectPersistedStateDiagnostics(storageKey: string, persistedQuery: PersistedQuery): ErrorReportPersistedQueryDiagnostics {
	const state = persistedQuery.state;

	return {
		storageKey,
		buster: persistedQuery.buster,
		queryHash: persistedQuery.queryHash,
		queryKey: createDiagnosticValue(persistedQuery.queryKey),
		status: state.status,
		fetchStatus: state.fetchStatus,
		dataUpdatedAt: state.dataUpdatedAt,
		errorUpdatedAt: state.errorUpdatedAt,
		failureCount: state.fetchFailureCount,
		error: state.error ? createErrorInfo(state.error) : undefined
	};
}

/**
 * Читает IndexedDB persistence и возвращает только технические поля.
 * `state.data` и другие значения кеша не попадают в результат.
 */
export async function collectPersistedQueryDiagnostics(): Promise<ErrorReportPersistedQueryDiagnostics[]> {
	const storage = createIndexedDbQueryStorage<PersistedQuery>();
	if (!storage?.entries) return [];

	try {
		const entries = await storage.entries();
		return entries
			.slice(-MAX_PERSISTED_QUERY_DIAGNOSTICS)
			.map(([storageKey, persistedQuery]) => collectPersistedStateDiagnostics(storageKey, persistedQuery));
	} catch {
		return [];
	}
}
