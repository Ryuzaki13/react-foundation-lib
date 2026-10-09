// @vitest-environment jsdom

import { QueryClient } from "@tanstack/react-query";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Compile-time __DEV__ в общей test config включён. Подменяется только этот
// environment gate; сами public capture, schema, storage и dedup остаются настоящими.
vi.mock("./environment", async (importOriginal) => ({
	...(await importOriginal<typeof import("./environment")>()),
	isErrorReportingEnabled: () => true
}));

let disposeReporter: (() => void) | undefined;

beforeEach(() => {
	vi.resetModules();
	sessionStorage.clear();
});

afterEach(() => {
	disposeReporter?.();
	disposeReporter = undefined;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function readPublicApi() {
	const api = await import("./index");
	disposeReporter = () => api.setErrorReportRuntimeErrorReporter(undefined);
	return api;
}

function observeBrowserStorage() {
	const getItem = vi.spyOn(Storage.prototype, "getItem");
	const setItem = vi.spyOn(Storage.prototype, "setItem");
	const removeItem = vi.spyOn(Storage.prototype, "removeItem");
	const clear = vi.spyOn(Storage.prototype, "clear");
	const openDatabase = vi.fn(() => {
		throw new Error("IndexedDB не должен открываться");
	});
	const openCache = vi.fn(() => {
		throw new Error("CacheStorage не должен открываться");
	});
	vi.stubGlobal("indexedDB", { open: openDatabase });
	vi.stubGlobal("caches", { open: openCache });
	return { getItem, setItem, removeItem, clear, openDatabase, openCache };
}

describe("error-report browser storage policy", () => {
	it("импорт public subpath не читает browser storage", async () => {
		const calls = observeBrowserStorage();
		await readPublicApi();
		for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
	});

	it("создаёт bounded memory drafts со стабильным собственным session ID и сохраняет Promise для UI", async () => {
		const calls = observeBrowserStorage();
		const api = await readPublicApi();
		api.disableErrorReportBrowserStorage();
		const capture = api.captureRuntimeErrorReport(new Error("Ошибка компонента"), { category: "react" });
		const first = await capture.then((draft) => draft);
		if (!first) throw new Error("Production capture должен создать memory draft");
		expect(first).toMatchObject({ category: "react", status: "pending" });
		expect(api.getErrorReportDraft(first.reportId)).toEqual(first);
		expect(api.updateErrorReportDraft(first.reportId, { status: "sent" })?.status).toBe("sent");

		for (let index = 0; index < 12; index += 1) {
			api.captureErrorReportDraft({
				category: "runtime",
				source: "bounded-memory",
				error: api.createErrorInfo(new Error(`Ошибка ${index}`))
			});
		}
		const drafts = api.getErrorReportDrafts();
		expect(drafts).toHaveLength(10);
		expect(drafts.every((draft) => draft.sessionId === first.sessionId)).toBe(true);
		expect(drafts.at(-1)?.payload.error.message).toBe("Ошибка 11");
		expect(api.getErrorReportDraft(first.reportId)).toBeUndefined();
		for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
	});

	it("capture options и reporter lifecycle не возвращают memory document в browser mode", async () => {
		const calls = observeBrowserStorage();
		const api = await readPublicApi();
		api.disableErrorReportBrowserStorage();
		api.disableErrorReportBrowserStorage();
		api.setErrorReportCaptureOptions({ valuePolicy: "verbatim", dataPreviewBytes: { persistedQuery: 1_024 } });
		api.setErrorReportCaptureOptions(undefined);
		api.setErrorReportRuntimeErrorReporter(undefined);
		api.setErrorReportTransportErrorReporter(undefined);

		const client = new QueryClient();
		client.setQueryData(["memory"], { value: 42 });
		const query = client.getQueryCache().find({ queryKey: ["memory"] });
		if (!query) throw new Error("QueryClient должен содержать подготовленную query");
		const mutation = client.getMutationCache().build(client, { mutationKey: ["memory-write"] });
		const [queryDraft, mutationDraft, runtimeDraft] = await Promise.all([
			api.captureQueryErrorReport(new Error("query"), query, client),
			api.captureMutationErrorReport(new Error("mutation"), mutation, client),
			api.captureRuntimeErrorReport(new Error("runtime"), {}, client)
		]);
		expect([queryDraft?.category, mutationDraft?.category, runtimeDraft?.category]).toEqual(["query", "mutation", "runtime"]);
		expect(await api.collectPersistedQueryDiagnostics()).toEqual([]);
		for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
	});

	it("по умолчанию лениво восстанавливает прежние drafts и сохраняет публичные get/update", async () => {
		const initialApi = await readPublicApi();
		const initial = initialApi.captureErrorReportDraft({
			category: "runtime",
			source: "ordinary",
			error: initialApi.createErrorInfo(new Error("Сохранено"))
		});
		if (!initial) throw new Error("Обычный capture должен создать исходный draft");
		vi.resetModules();
		const getItem = vi.spyOn(Storage.prototype, "getItem");
		const api = await readPublicApi();
		expect(getItem).not.toHaveBeenCalled();
		expect(api.getErrorReportDrafts()).toEqual([initial]);
		expect(api.getErrorReportDraft(initial.reportId)).toEqual(initial);
		expect(getItem).toHaveBeenCalledTimes(1);
		api.updateErrorReportDraft(initial.reportId, { status: "failed", failedReason: "Повторить" });
		const second = api.captureErrorReportDraft({
			category: "runtime",
			source: "ordinary",
			error: api.createErrorInfo(new Error("Следующий"))
		});
		if (!second) throw new Error("Обычный capture должен создать следующий draft");
		expect(second.sessionId).toBe(initial.sessionId);

		vi.resetModules();
		const restoredApi = await readPublicApi();
		expect(restoredApi.getErrorReportDraft(initial.reportId)).toMatchObject({ status: "failed", failedReason: "Повторить" });
		expect(restoredApi.getErrorReportDraft(second.reportId)).toEqual(second);
	});

	it("не переносит обычный draft/session ID/dedup в память и не удаляет browser records", async () => {
		const api = await readPublicApi();
		const error = new Error("Повторяемая ошибка");
		const ordinaryCapture = api.captureRuntimeErrorReport(error);
		const ordinary = await ordinaryCapture;
		const before = { ...sessionStorage };
		const calls = observeBrowserStorage();
		api.disableErrorReportBrowserStorage();
		expect(api.getErrorReportDrafts()).toEqual([]);
		const memoryCapture = api.captureRuntimeErrorReport(error);
		const memory = await memoryCapture;
		expect(memoryCapture).not.toBe(ordinaryCapture);
		expect(memory?.sessionId).not.toBe(ordinary?.sessionId);
		expect(memory?.reportId).not.toBe(ordinary?.reportId);
		api.disableErrorReportBrowserStorage();
		expect(api.getErrorReportDrafts()).toEqual([memory]);
		for (const call of Object.values(calls)) expect(call).not.toHaveBeenCalled();
		expect({ ...sessionStorage }).toEqual(before);
	});

	it("отбрасывает поздний IDB snapshot и завершает ожидающий capture в памяти без browser write", async () => {
		vi.stubGlobal("indexedDB", new IDBFactory());
		const storageApi = await import("../query-client");
		const storage = storageApi.createIndexedDbQueryStorage();
		if (!storage) throw new Error("Тестовая IDBFactory должна предоставить storage");
		const client = new QueryClient();
		client.setQueryData(["late-persisted-marker"], { value: "previous-browser-record" });
		const query = client.getQueryCache().find({ queryKey: ["late-persisted-marker"] });
		if (!query) throw new Error("QueryClient должен содержать подготовленную query");
		await storage.setItem("stored-query", {
			buster: "synthetic",
			queryHash: query.queryHash,
			queryKey: query.queryKey,
			state: query.state
		});
		let releaseRead = () => {};
		const holdRead = new Promise<void>((resolve) => {
			releaseRead = resolve;
		});
		let notifyRead = () => {};
		const readStarted = new Promise<void>((resolve) => {
			notifyRead = resolve;
		});
		const createStorage = storageApi.createIndexedDbQueryStorage;
		vi.spyOn(storageApi, "createIndexedDbQueryStorage").mockImplementation((options) => {
			const created = createStorage(options);
			if (!created) return undefined;
			return {
				...created,
				entries: async () => {
					const entries = await created.entries();
					notifyRead();
					await holdRead;
					return entries;
				}
			};
		});
		const api = await readPublicApi();
		const pendingDiagnostics = api.collectPersistedQueryDiagnostics();
		const pendingCapture = api.captureQueryErrorReport(new Error("late query"), query, client);
		await readStarted;
		const setItem = vi.spyOn(Storage.prototype, "setItem");
		api.disableErrorReportBrowserStorage();
		releaseRead();
		expect(await pendingDiagnostics).toEqual([]);
		const draft = await pendingCapture;
		expect(draft?.category).toBe("query");
		expect(draft?.payload.persistedQueries).toBeUndefined();
		expect(api.getErrorReportDrafts()).toEqual([draft]);
		expect(setItem).not.toHaveBeenCalled();
		expect(await storage.getItem("stored-query")).toBeDefined();
	});
});
