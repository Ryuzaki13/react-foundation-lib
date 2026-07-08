export type ErrorReportTransportHtmlSummary = {
	length: number;
	title?: string;
	formCount?: number;
	inputNames?: string[];
	textPreview?: string;
};

export type ErrorReportTransportErrorContext = {
	source: "fetch.parseResponse" | "fetch.buildHttpError";
	requestUrl?: string;
	responseUrl?: string;
	method?: string;
	baseUrlType?: string;
	sapClient?: string | null;
	status?: number;
	statusText?: string;
	contentType?: string;
	redirected?: boolean;
	responseType?: string;
	html?: ErrorReportTransportHtmlSummary;
};

export type ErrorReportTransportErrorReporter = (error: Error, context: ErrorReportTransportErrorContext) => void | Promise<void>;

const DEDUPLICATION_INTERVAL_MS = 60_000;
const MAX_RECENT_REPORT_KEYS = 100;
const TRANSPORT_REPORT_DELAY_MS = 250;

let transportErrorReporter: ErrorReportTransportErrorReporter | undefined;
const scheduledTransportErrors = new WeakSet<Error>();
const suppressedTransportErrors = new WeakSet<Error>();
const recentReportKeys = new Map<string, number>();

function createReportKey(context: ErrorReportTransportErrorContext) {
	return [context.source, context.method, context.status, context.requestUrl, context.responseUrl].filter(Boolean).join("|");
}

function shouldSkipByRecentKey(context: ErrorReportTransportErrorContext) {
	const now = Date.now();
	const key = createReportKey(context);

	for (const [recentKey, timestamp] of recentReportKeys) {
		if (now - timestamp > DEDUPLICATION_INTERVAL_MS || recentReportKeys.size > MAX_RECENT_REPORT_KEYS) {
			recentReportKeys.delete(recentKey);
		}
	}

	const lastReportedAt = recentReportKeys.get(key);
	if (lastReportedAt && now - lastReportedAt < DEDUPLICATION_INTERVAL_MS) return true;

	recentReportKeys.set(key, now);
	return false;
}

/**
 * Регистрирует приложение как получателя транспортных ошибок.
 * Сам OData transport не знает про QueryClient и UI, поэтому только публикует событие,
 * а app-слой решает, как именно создать и отправить отчет.
 */
export function setErrorReportTransportErrorReporter(reporter: ErrorReportTransportErrorReporter | undefined) {
	transportErrorReporter = reporter;
	recentReportKeys.clear();
}

export function isTransportErrorReportScheduled(error: unknown) {
	return error instanceof Error && scheduledTransportErrors.has(error);
}

export function suppressTransportErrorReport(error: unknown) {
	if (error instanceof Error) {
		suppressedTransportErrors.add(error);
	}
}

export function reportTransportError(error: Error, context: ErrorReportTransportErrorContext) {
	scheduledTransportErrors.add(error);

	// Даем React Query шанс перехватить эту же ошибку и создать query/mutation-отчет
	// с более полезным снимком кеша. Если такого перехвата нет, transport-отчет уйдет сам.
	setTimeout(() => {
		if (suppressedTransportErrors.has(error)) return;
		if (!transportErrorReporter) return;
		if (shouldSkipByRecentKey(context)) return;

		try {
			const result = transportErrorReporter(error, context);
			void Promise.resolve(result).catch(() => undefined);
		} catch {
			// Ошибка диагностического hook не должна менять поведение исходного fetch.
		}
	}, TRANSPORT_REPORT_DELAY_MS);
}
