import { uuidv4 } from "../crypto";
import { formatDateAsODataDatetime } from "../formatters";
import { getSessionStorageId } from "../session-storage";

import { getErrorReportBreadcrumbs } from "./breadcrumbs";
import { getErrorReportClientEnvironment, getErrorReportEnvironment, isErrorReportingEnabled } from "./environment";
import { ERROR_REPORT_PAYLOAD_VERSION, limitErrorReportPayload } from "./payload";
import { sanitizeDetail, sanitizeDiagnosticText, sanitizeErrorReportValue } from "./safeValue";
import { parseErrorReportDraft, parseErrorReportDrafts } from "./schema";

import type {
	ErrorReportCategory,
	ErrorReportDraft,
	ErrorReportDraftLifecyclePatch,
	ErrorReportErrorInfo,
	ErrorReportPayload,
	ErrorReportSafeValue
} from "./types";

const STORAGE_KEY = `${__APP_ID__}.errorReport.drafts.v2`;
const SESSION_STORAGE_KEY = `${__APP_ID__}.errorReport.sessionId.v1`;
const MAX_DRAFTS = 10;

let drafts = loadDrafts();

function nowUtc() {
	return formatDateAsODataDatetime(new Date());
}

function loadDrafts(): ErrorReportDraft[] {
	if (typeof sessionStorage === "undefined") return [];

	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		return parseErrorReportDrafts(raw ? JSON.parse(raw) : []);
	} catch {
		return [];
	}
}

function saveDrafts(nextDrafts: ErrorReportDraft[]) {
	drafts = nextDrafts.slice(-MAX_DRAFTS);
	if (typeof sessionStorage === "undefined") return;

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
	} catch {
		// Переполнение sessionStorage не должно ломать пользовательский сценарий.
	}
}

function getLocationSnapshot() {
	if (typeof window === "undefined") return undefined;

	return {
		pathname: window.location.pathname,
		origin: window.location.origin
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
	return drafts.find((draft) => draft.reportId === reportId);
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

	saveDrafts(drafts.map((draft) => (draft.reportId === reportId ? parsed : draft)));
	return parsed;
}

export function getErrorReportDrafts() {
	return drafts;
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
	const sessionId = getSessionStorageId(SESSION_STORAGE_KEY);
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
		persistedQueries: args.persistedQueries,
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

	saveDrafts([...drafts, parsed]);
	return parsed;
}
