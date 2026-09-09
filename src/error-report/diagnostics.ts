import { type PersistedQuery } from "@tanstack/query-persist-client-core";
import { type MutationKey, type MutationState, type QueryClient, type QueryKey, type QueryState } from "@tanstack/react-query";

import { hashString128 } from "../crypto";
import { createIndexedDbQueryStorage } from "../query-client";
import { stableStringify } from "../utils";

import { createErrorInfo } from "./errorInfo";
import { createDataShape, sanitizeDetail, sanitizeDiagnosticText, sanitizeErrorReportValue } from "./safeValue";
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

function sanitizeMeta(
	meta: Record<string, unknown> | undefined,
	scope: "mutation-meta" | "query-meta",
	source?: string
): Record<string, ErrorReportSafeValue> | undefined {
	return sanitizeDetail(meta, { scope, source });
}

export function collectQueryDiagnostics(query: QueryDiagnosticSource): ErrorReportQueryDiagnostics {
	const queryKey = sanitizeErrorReportValue(query.queryKey, { scope: "query-key" }) ?? { type: "redacted" };
	const queryHash = hashString128(stableStringify(queryKey));

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
		meta: sanitizeMeta(query.meta, "query-meta", queryHash),
		dataShape: sanitizeErrorReportValue(createDataShape(query.state.data), {
			scope: "query-data-shape",
			source: queryHash
		}),
		error: query.state.error ? createErrorInfo(query.state.error) : undefined
	};
}

export function collectMutationDiagnostics(mutation: MutationDiagnosticSource): ErrorReportMutationDiagnostics {
	return {
		mutationKey: mutation.options.mutationKey
			? sanitizeErrorReportValue(mutation.options.mutationKey, { scope: "mutation-key" })
			: undefined,
		status: mutation.state.status,
		failureCount: mutation.state.failureCount,
		submittedAt: mutation.state.submittedAt,
		meta: sanitizeMeta(mutation.meta, "mutation-meta"),
		error: mutation.state.error ? createErrorInfo(mutation.state.error) : undefined
	};
}

export function collectQueryClientDiagnostics(queryClient: QueryClient) {
	return {
		queries: queryClient.getQueryCache().getAll().slice(-MAX_QUERY_DIAGNOSTICS).map(collectQueryDiagnostics),
		mutations: queryClient.getMutationCache().getAll().slice(-MAX_MUTATION_DIAGNOSTICS).map(collectMutationDiagnostics)
	};
}

function collectPersistedStateDiagnostics(persistedQuery: PersistedQuery): ErrorReportPersistedQueryDiagnostics {
	const state = persistedQuery.state;
	const queryKey = sanitizeErrorReportValue(persistedQuery.queryKey, { scope: "persisted-query-key" });
	const queryHash = queryKey ? hashString128(stableStringify(queryKey)) : undefined;

	return {
		buster: persistedQuery.buster ? sanitizeDiagnosticText(persistedQuery.buster, 512) : undefined,
		queryHash,
		queryKey,
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
			.map(([, persistedQuery]) => collectPersistedStateDiagnostics(persistedQuery));
	} catch {
		return [];
	}
}
