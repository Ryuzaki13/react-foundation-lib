import { clearRuntimeErrorReportDeduplication } from "./runtimeDeduplication";

import type { ErrorReportRuntimeContext } from "./types";

export type ErrorReportRuntimeErrorReporter = (error: unknown, context: ErrorReportRuntimeContext) => void | Promise<void>;

let runtimeErrorReporter: ErrorReportRuntimeErrorReporter | undefined;

/**
 * Регистрирует app-слой как получателя ручных runtime-ошибок.
 * Shared-код может вызвать reportRuntimeError без знания о QueryClient, UI и режиме доставки.
 */
export function setErrorReportRuntimeErrorReporter(reporter: ErrorReportRuntimeErrorReporter | undefined) {
	runtimeErrorReporter = reporter;
	clearRuntimeErrorReportDeduplication();
}

/**
 * Ручная отправка runtime-ошибки из try/catch или другого кода вне React-компонента.
 * Функция не бросает исключений: диагностический отчет не должен ломать основной сценарий.
 *
 * @example
 *
 * try {
 *  // ...
 * } catch (error) {
 *  reportRuntimeError(error, {
 *      detail: {
 *          source: "s3-download",
 *          action: "download-from-s3"
 *      }
 *  });
 * }
 */
export async function reportRuntimeError(error: unknown, context: ErrorReportRuntimeContext = {}) {
	if (!runtimeErrorReporter) return;

	try {
		await runtimeErrorReporter(error, context);
	} catch {
		// Ошибка диагностического hook не должна менять поведение пользовательского кода.
	}
}
