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
import {
	ERROR_REPORT_BREADCRUMB_QUERY_ERROR,
	ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL,
	ERROR_REPORT_CATEGORY_QUERY,
	ERROR_REPORT_SCOPE_CONTEXT,
	ERROR_REPORT_BREADCRUMB_MUTATION_ERROR,
	ERROR_REPORT_CATEGORY_MUTATION,
	ERROR_REPORT_CATEGORY_RUNTIME,
	ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR,
	ERROR_REPORT_SOURCE_MUTATION
} from "./errorReportContractConstants";
import { coalesceRuntimeErrorReportCapture } from "./runtimeDeduplication";
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
		type: ERROR_REPORT_BREADCRUMB_QUERY_ERROR,
		detail: sanitizeDetail(
			{
				queryKey: context?.queryKey ?? query.queryKey,
				...context?.detail
			},
			{ scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL, source }
		)
	});

	const [persistedQueries, queryClientDiagnostics] = await Promise.all([
		collectPersistedQueryDiagnostics(),
		Promise.resolve(collectQueryClientDiagnostics(queryClient))
	]);

	return captureErrorReportDraft({
		category: ERROR_REPORT_CATEGORY_QUERY,
		source,
		error: context?.errorInfo ?? createErrorInfo(error),
		query: collectQueryDiagnostics(query),
		queryClient: queryClientDiagnostics,
		persistedQueries,
		context: sanitizeDetail(context?.detail, { scope: ERROR_REPORT_SCOPE_CONTEXT, source })
	});
}

export async function captureMutationErrorReport(
	error: unknown,
	mutation: Mutation<unknown, unknown, unknown, unknown>,
	queryClient: QueryClient,
	context: ErrorReportMutationContext = {}
) {
	suppressTransportErrorReport(error);
	const source = context.source ?? ERROR_REPORT_SOURCE_MUTATION;

	addErrorReportBreadcrumb({
		type: ERROR_REPORT_BREADCRUMB_MUTATION_ERROR,
		detail: sanitizeDetail(
			{ mutationKey: mutation.options.mutationKey, ...context.detail },
			{ scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL, source }
		)
	});

	const [persistedQueries, queryClientDiagnostics] = await Promise.all([
		collectPersistedQueryDiagnostics(),
		Promise.resolve(collectQueryClientDiagnostics(queryClient))
	]);

	return captureErrorReportDraft({
		category: ERROR_REPORT_CATEGORY_MUTATION,
		source,
		error: context.errorInfo ?? createErrorInfo(error),
		mutation: collectMutationDiagnostics(mutation),
		queryClient: queryClientDiagnostics,
		persistedQueries,
		context: sanitizeDetail(context.detail, { scope: ERROR_REPORT_SCOPE_CONTEXT, source })
	});
}

export function captureRuntimeErrorReport(error: unknown, context: ErrorReportRuntimeContext = {}, queryClient?: QueryClient) {
	const category = context.category ?? ERROR_REPORT_CATEGORY_RUNTIME;
	const source = context.source ?? context.category ?? ERROR_REPORT_CATEGORY_RUNTIME;
	const errorInfo = context.errorInfo ?? createErrorInfo(error);
	const detail = sanitizeDetail(context.detail, { scope: ERROR_REPORT_SCOPE_CONTEXT, source });

	const captureDraft = async () => {
		addErrorReportBreadcrumb({
			type: ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR,
			detail: sanitizeDetail({ category, source, ...context.detail }, { scope: ERROR_REPORT_SCOPE_BREADCRUMB_DETAIL, source })
		});

		const [persistedQueries, queryClientDiagnostics] = queryClient
			? await Promise.all([collectPersistedQueryDiagnostics(), Promise.resolve(collectQueryClientDiagnostics(queryClient))])
			: [undefined, undefined];

		return captureErrorReportDraft({
			category,
			source,
			error: errorInfo,
			react: context.componentStack ? { componentStack: context.componentStack } : undefined,
			queryClient: queryClientDiagnostics,
			persistedQueries,
			context: detail
		});
	};

	/**
	 * Error report draft создаётся только в браузере. Прямой вызов capture
	 * сохраняет прежнее SSR-поведение без клиентского TTL-таймера, который
	 * иначе удерживал бы Node-процесс после no-op результата.
	 */
	if (typeof window === "undefined") {
		return captureDraft();
	}

	return coalesceRuntimeErrorReportCapture(
		{
			category,
			source,
			error: errorInfo,
			pathname: window.location.pathname,
			scope: {
				componentStack: context.componentStack,
				detail
			}
		},
		captureDraft
	);
}
