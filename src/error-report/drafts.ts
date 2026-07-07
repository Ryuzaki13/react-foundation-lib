import { uuidv4 } from "../crypto";
import { formatDateAsODataDatetime } from "../formatters";
import { getSessionStorageId } from "../session-storage";

import { getErrorReportBreadcrumbs } from "./breadcrumbs";
import { getErrorReportClientEnvironment, getErrorReportEnvironment, isErrorReportingEnabled } from "./environment";

import type { ErrorReportCategory, ErrorReportDraft, ErrorReportErrorInfo, ErrorReportPayload, ErrorReportSafeValue } from "./types";

const STORAGE_KEY = `${__APP_ID__}.errorReport.drafts.v1`;
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
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? (parsed as ErrorReportDraft[]) : [];
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

export function getErrorReportDraft(reportId: string) {
	return drafts.find((draft) => draft.reportId === reportId);
}

export function updateErrorReportDraft(reportId: string, patch: Partial<ErrorReportDraft>) {
	const current = getErrorReportDraft(reportId);
	if (!current) return undefined;

	const next = { ...current, ...patch };
	saveDrafts(drafts.map((draft) => (draft.reportId === reportId ? next : draft)));
	return next;
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
	const payload: ErrorReportPayload = {
		reportId,
		sessionId,
		createdUtc,
		category: args.category,
		source: args.source,
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
		context: args.context
	};
	const draft: ErrorReportDraft = {
		reportId,
		sessionId,
		createdUtc,
		category: args.category,
		status: "pending",
		payload
	};

	saveDrafts([...drafts, draft]);
	return draft;
}
