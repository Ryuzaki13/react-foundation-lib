import { ERROR_REPORT_VALUE_POLICY_REDACTED, type ERROR_REPORT_VALUE_POLICY_VERBATIM } from "./capturePolicyConstants";
import { ERROR_REPORT_DATA_PREVIEW_MAX_BYTES } from "./errorReportCaptureLimits";
/**
 * Политика сбора задаётся приложением на время жизни его error-report lifecycle.
 * По умолчанию прежняя очистка остаётся активной для существующих потребителей.
 */
export type ErrorReportCaptureOptions = {
	valuePolicy?: typeof ERROR_REPORT_VALUE_POLICY_REDACTED | typeof ERROR_REPORT_VALUE_POLICY_VERBATIM;
	dataPreviewBytes?: {
		query?: number;
		persistedQuery?: number;
		mutation?: number;
	};
};

type ResolvedErrorReportCaptureOptions = {
	valuePolicy: typeof ERROR_REPORT_VALUE_POLICY_REDACTED | typeof ERROR_REPORT_VALUE_POLICY_VERBATIM;
	dataPreviewBytes: {
		query: number;
		persistedQuery: number;
		mutation: number;
	};
};

const DEFAULT_OPTIONS: ResolvedErrorReportCaptureOptions = {
	valuePolicy: ERROR_REPORT_VALUE_POLICY_REDACTED,
	dataPreviewBytes: { query: 0, persistedQuery: 0, mutation: 0 }
};

let captureOptions = DEFAULT_OPTIONS;

function boundedPreviewBytes(value: number | undefined) {
	if (value === undefined || !Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(ERROR_REPORT_DATA_PREVIEW_MAX_BYTES, Math.trunc(value)));
}

/** `undefined` возвращает policy пакета и отключает сбор данных кэша. */
export function setErrorReportCaptureOptions(options: ErrorReportCaptureOptions | undefined) {
	captureOptions = options
		? {
				valuePolicy: options.valuePolicy ?? DEFAULT_OPTIONS.valuePolicy,
				dataPreviewBytes: {
					query: boundedPreviewBytes(options.dataPreviewBytes?.query),
					persistedQuery: boundedPreviewBytes(options.dataPreviewBytes?.persistedQuery),
					mutation: boundedPreviewBytes(options.dataPreviewBytes?.mutation)
				}
			}
		: DEFAULT_OPTIONS;
}

/** Внутренний снимок настроек на момент сбора отдельной секции. */
export function getErrorReportCaptureOptions(): Readonly<ResolvedErrorReportCaptureOptions> {
	return captureOptions;
}
