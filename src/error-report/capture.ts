import { type Mutation, type Query, type QueryClient } from "@tanstack/react-query";

import { addErrorReportBreadcrumb } from "./breadcrumbs";
import {
	collectMutationDiagnostics,
	collectPersistedQueryDiagnostics,
	collectQueryClientDiagnostics,
	collectQueryDiagnostics
} from "./diagnostics";
import { captureErrorReportDraft } from "./drafts";
import { createErrorInfo } from "./errorInfo";
import { sanitizeDetail } from "./safeValue";
import { suppressTransportErrorReport } from "./transport";

import type { ErrorReportMutationContext, ErrorReportQueryContext, ErrorReportRuntimeContext } from "./types";

export async function captureQueryErrorReport(
	error: unknown,
	query: Query<unknown, unknown, unknown>,
	queryClient: QueryClient,
	context?: ErrorReportQueryContext
) {
	suppressTransportErrorReport(error);
	const source = context?.source ?? "query";

	addErrorReportBreadcrumb({
		type: "query-error",
		detail: sanitizeDetail({
			queryHash: query.queryHash,
			queryKey: context?.queryKey ?? query.queryKey,
			...context?.detail
		})
	});

	const [persistedQueries, queryClientDiagnostics] = await Promise.all([
		collectPersistedQueryDiagnostics(),
		Promise.resolve(collectQueryClientDiagnostics(queryClient))
	]);

	return captureErrorReportDraft({
		category: "query",
		source,
		error: context?.errorInfo ?? createErrorInfo(error),
		query: collectQueryDiagnostics(query),
		queryClient: queryClientDiagnostics,
		persistedQueries,
		context: sanitizeDetail(context?.detail)
	});
}

export async function captureMutationErrorReport(
	error: unknown,
	mutation: Mutation<unknown, unknown, unknown, unknown>,
	queryClient: QueryClient,
	context: ErrorReportMutationContext = {}
) {
	suppressTransportErrorReport(error);
	const source = context.source ?? "mutation";

	addErrorReportBreadcrumb({
		type: "mutation-error",
		detail: sanitizeDetail({ mutationKey: mutation.options.mutationKey, ...context.detail })
	});

	const [persistedQueries, queryClientDiagnostics] = await Promise.all([
		collectPersistedQueryDiagnostics(),
		Promise.resolve(collectQueryClientDiagnostics(queryClient))
	]);

	return captureErrorReportDraft({
		category: "mutation",
		source,
		error: context.errorInfo ?? createErrorInfo(error),
		mutation: collectMutationDiagnostics(mutation),
		queryClient: queryClientDiagnostics,
		persistedQueries
	});
}

export async function captureRuntimeErrorReport(error: unknown, context: ErrorReportRuntimeContext = {}, queryClient?: QueryClient) {
	const source = context.source ?? context.category ?? "runtime";

	addErrorReportBreadcrumb({
		type: "runtime-error",
		detail: sanitizeDetail({ category: context.category ?? "runtime", source, ...context.detail })
	});

	const [persistedQueries, queryClientDiagnostics] = queryClient
		? await Promise.all([collectPersistedQueryDiagnostics(), Promise.resolve(collectQueryClientDiagnostics(queryClient))])
		: [undefined, undefined];

	return captureErrorReportDraft({
		category: context.category ?? "runtime",
		source,
		error: context.errorInfo ?? createErrorInfo(error),
		react: context.componentStack ? { componentStack: context.componentStack } : undefined,
		queryClient: queryClientDiagnostics,
		persistedQueries,
		context: sanitizeDetail(context.detail)
	});
}
