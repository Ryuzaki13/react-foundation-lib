import { uuidv4 } from "../crypto";
import { getSessionStorageId } from "../session-storage";

import { clearRuntimeErrorReportDeduplication } from "./runtimeDeduplication";
import { parseErrorReportDrafts } from "./schema";
import { type ErrorReportDraft } from "./types";

const STORAGE_KEY = `${__APP_ID__}.errorReport.drafts.v2`;
const SESSION_STORAGE_KEY = `${__APP_ID__}.errorReport.sessionId.v1`;
const MAX_DRAFTS = 10;

let browserStorageDisabled = false;
let browserDrafts: ErrorReportDraft[] | undefined;
let memoryDrafts: ErrorReportDraft[] = [];
let memorySessionId: string | undefined;

/**
 * До конца текущего browser document переводит capture, drafts и persisted
 * diagnostics в память. Повторный вызов безопасен; capture options и reporter
 * lifecycle не включают storage обратно. При SSR вызов ничего не меняет.
 *
 * Вызывать до первого capture. Уже начатое чтение отменить нельзя, но его
 * поздний результат не попадёт в memory draft. Существующие browser records
 * не удаляются. Явно созданная createErrorReportQueue независима: приложение
 * обязано отдельно исключить её создание и доставку в таком документе.
 */
export function disableErrorReportBrowserStorage(): void {
	if (typeof window === "undefined" || browserStorageDisabled) return;

	browserStorageDisabled = true;
	// Снимок обычного режима не становится исходным содержимым memory store.
	browserDrafts = undefined;
	clearRuntimeErrorReportDeduplication();
}

/** Односторонняя граница проверяется и после await: обратного перехода нет. */
export function canUseErrorReportBrowserStorage(): boolean {
	return !browserStorageDisabled;
}

export function readErrorReportDrafts(): ErrorReportDraft[] {
	if (browserStorageDisabled) return memoryDrafts;
	if (browserDrafts === undefined) {
		// Lazy read позволяет выбрать memory policy даже после импорта subpath.
		browserDrafts = [];
		if (typeof sessionStorage !== "undefined") {
			try {
				const raw = sessionStorage.getItem(STORAGE_KEY);
				browserDrafts = parseErrorReportDrafts(raw ? JSON.parse(raw) : []);
			} catch {
				// Недоступное или повреждённое storage не ломает диагностику.
			}
		}
	}

	return browserDrafts;
}

export function saveErrorReportDrafts(nextDrafts: ErrorReportDraft[]): void {
	const boundedDrafts = nextDrafts.slice(-MAX_DRAFTS);
	if (browserStorageDisabled) {
		memoryDrafts = boundedDrafts;
		return;
	}

	browserDrafts = boundedDrafts;
	if (typeof sessionStorage === "undefined") return;

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(browserDrafts));
	} catch {
		// Переполнение sessionStorage не должно ломать пользовательский сценарий.
	}
}

export function getErrorReportSessionId(): string {
	if (browserStorageDisabled) {
		memorySessionId ??= uuidv4();
		return memorySessionId;
	}

	return getSessionStorageId(SESSION_STORAGE_KEY);
}
