import "../src/build-globals";

import {
	captureErrorReportDraft,
	captureMutationErrorReport,
	captureQueryErrorReport,
	captureRuntimeErrorReport,
	disableErrorReportBrowserStorage,
	getErrorReportDrafts,
	type ErrorReportDraft
} from "../src/error-report";

const disable: () => void = disableErrorReportBrowserStorage;
const runtime: ReturnType<typeof captureRuntimeErrorReport> = Promise.resolve(undefined);
const query: ReturnType<typeof captureQueryErrorReport> = Promise.resolve(undefined);
const mutation: ReturnType<typeof captureMutationErrorReport> = Promise.resolve(undefined);
const synchronous: ReturnType<typeof captureErrorReportDraft> = undefined;
const drafts: ErrorReportDraft[] = getErrorReportDrafts();
const result: Promise<ErrorReportDraft | undefined> = captureRuntimeErrorReport(new Error("UI boundary"));
// Такой .then использует опубликованный foundation-ui ErrorBoundary.
const uiResult: Promise<string | undefined> = result.then((draft) => draft?.reportId);
void [disable, runtime, query, mutation, synchronous, drafts, uiResult];
