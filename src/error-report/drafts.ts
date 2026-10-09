import { uuidv4 } from "../crypto";
import { formatDateAsODataDatetime } from "../formatters";

import { getErrorReportBreadcrumbs } from "./breadcrumbs";
import { getErrorReportCaptureOptions } from "./captureOptions";
import { getErrorReportClientEnvironment, getErrorReportEnvironment, isErrorReportingEnabled } from "./environment";
import {
	canUseErrorReportBrowserStorage,
	getErrorReportSessionId,
	readErrorReportDrafts,
	saveErrorReportDrafts
} from "./errorReportStorage";
import { ERROR_REPORT_PAYLOAD_VERSION, limitErrorReportPayload } from "./payload";
import { sanitizeDetail, sanitizeDiagnosticText, sanitizeErrorReportValue } from "./safeValue";
import { parseErrorReportDraft } from "./schema";

import type {
	ErrorReportCategory,
	ErrorReportDraft,
	ErrorReportDraftLifecyclePatch,
	ErrorReportErrorInfo,
	ErrorReportPayload,
	ErrorReportSafeValue
} from "./types";

function nowUtc() {
	return formatDateAsODataDatetime(new Date());
}

function getLocationSnapshot() {
	if (typeof window === "undefined") return undefined;

	const verbatim = getErrorReportCaptureOptions().valuePolicy === "verbatim";
	return {
		pathname: window.location.pathname,
		origin: window.location.origin,
		search: verbatim ? window.location.search : undefined,
		hash: verbatim ? window.location.hash : undefined
	};
}

function getViewportSnapshot() {
	if (typeof window === "undefined") return undefined;

	return {
		width: window.innerWidth,
		height: window.innerHeight,
		devicePixelRatio: window.devicePixelRatio
	};
}

function sanitizeFailedReason(value: string | undefined) {
	if (!value) return undefined;
	const sanitizedValue = sanitizeErrorReportValue(value, { scope: "draft-failed-reason", source: "delivery" });
	return typeof sanitizedValue === "string" ? sanitizedValue : undefined;
}

export function getErrorReportDraft(reportId: string) {
	return readErrorReportDrafts().find((draft) => draft.reportId === reportId);
}

export function updateErrorReportDraft(reportId: string, patch: ErrorReportDraftLifecyclePatch) {
	const current = getErrorReportDraft(reportId);
	if (!current) return undefined;

	const next = {
		...current,
		...patch,
		sentUtc: "sentUtc" in patch ? (patch.sentUtc ? sanitizeDiagnosticText(patch.sentUtc, 64) : undefined) : current.sentUtc,
		failedReason: "failedReason" in patch ? sanitizeFailedReason(patch.failedReason) : current.failedReason
	};
	const parsed = parseErrorReportDraft(next);
	if (!parsed) return undefined;

	saveErrorReportDrafts(readErrorReportDrafts().map((draft) => (draft.reportId === reportId ? parsed : draft)));
	return parsed;
}

export function getErrorReportDrafts() {
	return readErrorReportDrafts();
}

export function captureErrorReportDraft(args: {
	category: ErrorReportCategory;
	source: string;
	error: ErrorReportErrorInfo;
	query?: ErrorReportPayload["query"];
	mutation?: ErrorReportPayload["mutation"];
	queryClient?: ErrorReportPayload["queryClient"];
	persistedQueries?: ErrorReportPayload["persistedQueries"];
	react?: ErrorReportPayload["react"];
	context?: Record<string, ErrorReportSafeValue>;
}) {
	if (!isErrorReportingEnabled()) return undefined;

	const reportId = uuidv4();
	const sessionId = getErrorReportSessionId();
	const createdUtc = nowUtc();
	const payload = limitErrorReportPayload({
		payloadVersion: ERROR_REPORT_PAYLOAD_VERSION,
		application: __APP_ID__,
		reportId,
		sessionId,
		createdUtc,
		category: args.category,
		source: sanitizeDiagnosticText(args.source, 256),
		error: args.error,
		environment: getErrorReportEnvironment(),
		client: getErrorReportClientEnvironment(),
		location: getLocationSnapshot(),
		viewport: getViewportSnapshot(),
		react: args.react,
		query: args.query,
		mutation: args.mutation,
		queryClient: args.queryClient,
		// Между завершением diagnostics и capture мог сработать browser opt-out.
		persistedQueries: canUseErrorReportBrowserStorage() ? args.persistedQueries : undefined,
		breadcrumbs: getErrorReportBreadcrumbs(),
		context: sanitizeDetail(args.context, { scope: "context", source: args.source })
	} satisfies ErrorReportPayload);
	const draft: ErrorReportDraft = {
		reportId,
		sessionId,
		createdUtc,
		category: args.category,
		status: "pending",
		payload
	};
	const parsed = parseErrorReportDraft(draft);
	if (!parsed) return undefined;

	saveErrorReportDrafts([...readErrorReportDrafts(), parsed]);
	return parsed;
}
