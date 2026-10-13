import { experimental_createQueryPersister, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { dehydrate, hydrate, QueryClient, type Query, type QueryFunctionContext, type QueryState } from "@tanstack/react-query";
import { indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	clearSessionQueryPersistence,
	createIndexedDbQueryStorage,
	getSessionQueryPersistenceScope,
	REACT_QUERY_PERSISTENCE_BUSTER,
	setSessionQueryPersistenceScope,
	shouldPersistQuery
} from "./persistence";
import { createQueryClient } from "./queryClient";
import { createSessionQueryPersistenceMeta, persistedQueryMeta, QUERY_RESTORED_DATA_PARSER, sessionScopedQueryMeta } from "./queryMeta";

function createQueryMock(hash: string, meta: Query["meta"]): Query {
	return {
		meta,
		queryHash: hash,
		queryKey: [hash],
		state: {
			data: hash,
			dataUpdatedAt: Date.now()
		} as QueryState
	} as unknown as Query;
}

function createContextMock(queryKey: readonly unknown[]): QueryFunctionContext {
	return {
		client: new QueryClient(),
		queryKey,
		meta: undefined,
		signal: new AbortController().signal
	} as QueryFunctionContext;
}

async function waitForScheduledPersistence() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

afterEach(async () => {
	await setSessionQueryPersistenceScope(null);
	Reflect.deleteProperty(globalThis, "indexedDB");
});

describe("query-client/persistence", () => {
	it("сохраняет, читает, удаляет и перечисляет записи через IndexedDB", async () => {
		const storage = createIndexedDbQueryStorage<string>({
			indexedDB,
			dbName: "arm-query-storage-test"
		});

		expect(storage).toBeDefined();
		await storage!.setItem("first", "один");
		await storage!.setItem("second", "два");

		await expect(storage!.getItem("first")).resolves.toBe("один");
		await expect(storage!.entries!()).resolves.toEqual([
			["first", "один"],
			["second", "два"]
		]);

		await storage!.removeItem("first");

		await expect(storage!.getItem("first")).resolves.toBeUndefined();
		await expect(storage!.entries!()).resolves.toEqual([["second", "два"]]);
	});

	it("атомарно обновляет одну запись без Web Locks и не теряет параллельные изменения", async () => {
		const options = { indexedDB, dbName: `arm-query-atomic-${crypto.randomUUID()}`, storeName: "records" };
		const first = createIndexedDbQueryStorage<number>(options);
		const second = createIndexedDbQueryStorage<number>(options);
		if (!first || !second) throw new Error("IndexedDB storage не создан");
		await first.setItem("counter", 0);
		const increment = (storage: typeof first) =>
			storage.updateItem("counter", (value) => ({ action: "set", value: (value ?? 0) + 1, result: (value ?? 0) + 1 }));

		await Promise.all([increment(first), increment(second)]);

		await expect(first.getItem("counter")).resolves.toBe(2);
		await expect(first.updateItem("counter", (value) => ({ action: "keep", result: value }))).resolves.toBe(2);
		await first.updateItem("counter", () => ({ action: "remove", result: undefined }));
		await expect(first.getItem("counter")).resolves.toBeUndefined();
	});

	it("выбирает для сохранения только query с meta.persist = true", async () => {
		expect(shouldPersistQuery(createQueryMock("enabled", persistedQueryMeta))).toBe(true);
		expect(shouldPersistQuery(createQueryMock("disabled", undefined))).toBe(false);
		expect(shouldPersistQuery(createQueryMock("disabled-meta", { persist: false }))).toBe(false);
		expect(shouldPersistQuery(createQueryMock("session", sessionScopedQueryMeta))).toBe(false);
		expect(shouldPersistQuery(createQueryMock("conflicting", { persist: true, sessionScoped: true }))).toBe(false);
	});

	it("отклоняет неустойчивое имя и небезопасный лимит session cache", () => {
		expect(() => createSessionQueryPersistenceMeta({ cacheName: "Opened Weeks", maxEntries: 24 })).toThrow();
		expect(() => createSessionQueryPersistenceMeta({ cacheName: "opened-weeks", maxEntries: 0 })).toThrow();
		expect(() =>
			createSessionQueryPersistenceMeta({ cacheName: "opened-weeks", maxEntries: 24, monotonicRevisionField: "bad-field" })
		).toThrow();
		expect(() =>
			createSessionQueryPersistenceMeta({ cacheName: "opened-weeks", maxEntries: 24, refetchOnRestore: "never" as never })
		).toThrow();
	});

	it("per-query persister записывает в IndexedDB только opt-in query", async () => {
		const storage = createIndexedDbQueryStorage<PersistedQuery>({
			indexedDB,
			dbName: "arm-query-persister-test"
		});
		const persister = experimental_createQueryPersister<PersistedQuery>({
			storage,
			serialize: (query) => query,
			deserialize: (query) => query,
			buster: REACT_QUERY_PERSISTENCE_BUSTER,
			filters: { predicate: shouldPersistQuery }
		});

		await persister.persisterFn(
			async () => "persisted",
			createContextMock(["persisted"]),
			createQueryMock("persisted", persistedQueryMeta)
		);
		await persister.persisterFn(async () => "ignored", createContextMock(["ignored"]), createQueryMock("ignored", undefined));
		await waitForScheduledPersistence();

		const entries = await storage!.entries!();

		expect(entries).toHaveLength(1);
		expect(entries[0]?.[1].queryHash).toBe("persisted");
		expect(entries[0]?.[1].buster).toBe(REACT_QUERY_PERSISTENCE_BUSTER);
	});

	it("подключает persister в QueryClient только при доступном indexedDB", () => {
		const withoutIndexedDb = createQueryClient({});
		expect(withoutIndexedDb.getDefaultOptions().queries?.persister).toBeUndefined();

		Object.defineProperty(globalThis, "indexedDB", {
			configurable: true,
			value: indexedDB
		});

		const withIndexedDb = createQueryClient({});
		expect(withIndexedDb.getDefaultOptions().queries?.persister).toEqual(expect.any(Function));
	});

	it("изолирует persisted query текущей server session и восстанавливает только разрешённый snapshot", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "session-a", expiresAt: "2099-01-01T00:00:00.000Z" });
		const meta = createSessionQueryPersistenceMeta({ cacheName: "opened-weeks", maxEntries: 24 });
		const firstClient = createQueryClient({});

		await firstClient.fetchQuery({ queryKey: ["week", 1], queryFn: async () => "cached", meta });
		await waitForScheduledPersistence();

		const secondClient = createQueryClient({});
		let networkCalls = 0;
		await expect(
			secondClient.fetchQuery({
				queryKey: ["week", 1],
				queryFn: async () => {
					networkCalls += 1;
					return "network";
				},
				meta
			})
		).resolves.toBe("cached");
		expect(networkCalls).toBe(0);

		await setSessionQueryPersistenceScope({ id: "session-b", expiresAt: "2099-01-01T00:00:00.000Z" });
		const thirdClient = createQueryClient({});
		await expect(thirdClient.fetchQuery({ queryKey: ["week", 1], queryFn: async () => "other", meta })).resolves.toBe("other");
	});

	it("оставляет в session cache только последние успешно обновлённые query", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "bounded-session", expiresAt: "2099-01-01T00:00:00.000Z" });
		const meta = createSessionQueryPersistenceMeta({ cacheName: "bounded", maxEntries: 2 });
		const client = createQueryClient({});

		for (const key of ["first", "second", "third"]) {
			await client.fetchQuery({ queryKey: [key], queryFn: async () => key, meta });
			await new Promise((resolve) => setTimeout(resolve, 2));
		}
		await waitForScheduledPersistence();

		const storage = createIndexedDbQueryStorage<PersistedQuery>();
		const sessionEntries = (await storage!.entries()).filter(([key]) => key.includes("-session-bounded-session-bounded-"));
		expect(sessionEntries.map(([, value]) => value.queryKey)).toHaveLength(2);
		expect(sessionEntries.map(([, value]) => value.queryKey)).toEqual(expect.arrayContaining([["second"], ["third"]]));
	});

	it("не позволяет запоздавшей вкладке заменить сохранённый snapshot меньшей ревизией", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "revision-session", expiresAt: "2099-01-01T00:00:00.000Z" });
		const meta = {
			...createSessionQueryPersistenceMeta({
				cacheName: "references",
				maxEntries: 4,
				refetchOnRestore: false,
				monotonicRevisionField: "revision"
			}),
			[QUERY_RESTORED_DATA_PARSER]: (data: unknown) => data
		};
		const newerClient = createQueryClient({});
		const staleClient = createQueryClient({});
		const queryKey = ["reference", "branches"] as const;
		let releaseStaleRequest: (() => void) | undefined;
		let markStaleRequestStarted: (() => void) | undefined;
		const staleRequestStarted = new Promise<void>((resolve) => {
			markStaleRequestStarted = resolve;
		});
		const staleRequestGate = new Promise<void>((resolve) => {
			releaseStaleRequest = resolve;
		});

		const staleRequest = staleClient.fetchQuery({
			queryKey,
			queryFn: async () => {
				markStaleRequestStarted?.();
				await staleRequestGate;
				return { revision: "90071992547409929", items: ["old"] };
			},
			meta
		});
		await staleRequestStarted;
		await newerClient.fetchQuery({ queryKey, queryFn: async () => ({ revision: "90071992547409930", items: ["new"] }), meta });
		await waitForScheduledPersistence();
		releaseStaleRequest?.();
		await staleRequest;
		await waitForScheduledPersistence();

		const restoredClient = createQueryClient({});
		await expect(
			restoredClient.fetchQuery({
				queryKey,
				queryFn: async () => ({ revision: "90071992547409931", items: ["network"] }),
				meta
			})
		).resolves.toEqual({ revision: "90071992547409930", items: ["new"] });
	});

	it("не активирует истёкший scope и очищает его browser storage", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "expired", expiresAt: "2000-01-01T00:00:00.000Z" });

		expect(getSessionQueryPersistenceScope()).toBeNull();
		await expect(clearSessionQueryPersistence("expired")).resolves.toBeUndefined();
	});

	it("проверяет restore один раз до Query publication и сохраняет canonical identity без fetch", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "parsed-restore", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const queryKey = ["parsed", "one"] as const;
		const original = { revision: "7", items: [{ id: "first" }] };
		const firstClient = createQueryClient({});
		await firstClient.fetchQuery({ queryKey, queryFn: async () => original, meta: policy });
		await waitForScheduledPersistence();
		const canonical = Object.freeze({ revision: "7", items: Object.freeze([Object.freeze({ id: "first" })]) });
		const parser = vi.fn((data: unknown) => {
			expect(data).toEqual(original);
			return canonical;
		});
		const network = vi.fn(async () => ({ revision: "8", items: [] }));
		const secondClient = createQueryClient({});
		const options = { queryKey, queryFn: network, meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser }, staleTime: Infinity };
		expect(await secondClient.fetchQuery(options)).toBe(canonical);
		expect(secondClient.getQueryData(queryKey)).toBe(canonical);
		expect(await secondClient.fetchQuery(options)).toBe(canonical);
		await waitForScheduledPersistence();
		expect(parser).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});

	it("отклоняет повреждённый restore до scheduled refetch и сохраняет соседнюю запись", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "invalid-restore", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4 });
		const firstClient = createQueryClient({});
		await firstClient.fetchQuery({ queryKey: ["invalid"], queryFn: async () => "invalid", meta: policy });
		await firstClient.fetchQuery({ queryKey: ["neighbor"], queryFn: async () => "neighbor", meta: policy });
		await waitForScheduledPersistence();
		const storage = createIndexedDbQueryStorage<PersistedQuery>();
		if (!storage) throw new Error("IndexedDB storage не создан");
		const saved = (await storage.entries()).find(([, entry]) => entry.queryKey[0] === "invalid");
		if (!saved) throw new Error("Повреждённая запись не сохранена");
		const oldUpdatedAt = Date.now() - 60_000;
		await storage.setItem(saved[0], { ...saved[1], state: { ...saved[1].state, dataUpdatedAt: oldUpdatedAt } });
		const parser = vi.fn(() => {
			throw new Error("Некорректная форма persisted data.");
		});
		const network = vi.fn(async () => "fresh");
		const secondClient = createQueryClient({});
		expect(
			await secondClient.fetchQuery({
				queryKey: ["invalid"],
				queryFn: network,
				meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser }
			})
		).toBe("fresh");
		await waitForScheduledPersistence();
		expect(network).toHaveBeenCalledTimes(1);
		expect(parser).toHaveBeenCalledTimes(1);
		expect(secondClient.getQueryState(["invalid"])?.dataUpdatedAt).toBeGreaterThan(oldUpdatedAt);
		expect((await storage.entries()).some(([, entry]) => entry.queryKey[0] === "neighbor" && entry.state.data === "neighbor")).toBe(
			true
		);
		expect((await storage.getItem(saved[0]))?.state.data).toBe("fresh");
	});

	it("не запускает restore parser для обычного network read и не сохраняет callback", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "network-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
		const parser = vi.fn(() => "parsed");
		const client = createQueryClient({});
		const meta = {
			...createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4 }),
			[QUERY_RESTORED_DATA_PARSER]: parser
		};
		expect(await client.fetchQuery({ queryKey: ["network-parser"], queryFn: async () => "network", meta })).toBe("network");
		await waitForScheduledPersistence();
		expect(parser).not.toHaveBeenCalled();
		const storage = createIndexedDbQueryStorage<PersistedQuery>();
		if (!storage) throw new Error("IndexedDB storage не создан");
		const saved = (await storage.entries()).find(([, entry]) => entry.queryKey[0] === "network-parser")?.[1];
		expect(saved?.state.data).toBe("network");
		expect(Object.getOwnPropertySymbols(saved ?? {})).toHaveLength(0);
		expect(saved).not.toHaveProperty("meta");
	});

	it("сохраняет SSR hydration и исключает callback из сериализуемой metadata", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		const parser = vi.fn(() => "parsed");
		const server = new QueryClient();
		const meta = { ...persistedQueryMeta, [QUERY_RESTORED_DATA_PARSER]: parser };
		await server.fetchQuery({ queryKey: ["hydrated-parser"], queryFn: async () => "ssr", meta });
		const dehydrated = dehydrate(server);
		expect(dehydrated.queries[0]?.meta?.[QUERY_RESTORED_DATA_PARSER]).toBe(parser);
		const browser = createQueryClient({});
		hydrate(browser, JSON.parse(JSON.stringify(dehydrated)));
		const network = vi.fn(async () => "network");
		expect(await browser.fetchQuery({ queryKey: ["hydrated-parser"], queryFn: network, meta, staleTime: Infinity })).toBe("ssr");
		expect(parser).not.toHaveBeenCalled();
		expect(network).not.toHaveBeenCalled();
	});

	it.each(["expired", "busted"])("не проверяет %s запись дорогим restore parser", async (outdated) => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "outdated-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["outdated-parser"], queryFn: async () => "outdated", meta: policy });
		await waitForScheduledPersistence();
		const storage = createIndexedDbQueryStorage<PersistedQuery>();
		if (!storage) throw new Error("IndexedDB storage не создан");
		const entry = (await storage.entries()).find(([, stored]) => stored.queryKey[0] === "outdated-parser");
		if (!entry) throw new Error("Persisted запись не сохранена");
		await storage.setItem(
			entry[0],
			outdated === "busted" ? { ...entry[1], buster: "outdated" } : { ...entry[1], state: { ...entry[1].state, dataUpdatedAt: 1 } }
		);
		const parser = vi.fn(() => "parsed");
		const second = createQueryClient({});
		expect(
			await second.fetchQuery({
				queryKey: ["outdated-parser"],
				queryFn: async () => "network",
				meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser }
			})
		).toBe("network");
		expect(parser).not.toHaveBeenCalled();
	});

	it("отмена во время restore не публикует data и не запускает network fallback", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "cancel-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["cancel-parser"], queryFn: async () => "stored", meta: policy });
		await waitForScheduledPersistence();
		const storage = createIndexedDbQueryStorage<PersistedQuery>();
		if (!storage) throw new Error("IndexedDB storage не создан");
		const saved = (await storage.entries()).find(([, entry]) => entry.queryKey[0] === "cancel-parser");
		if (!saved) throw new Error("Рабочая запись не сохранена");
		const second = createQueryClient({});
		const network = vi.fn(async () => "network");
		const parser = vi.fn(() => {
			void second.cancelQueries({ queryKey: ["cancel-parser"], exact: true });
			return "parsed";
		});
		await expect(
			second.fetchQuery({ queryKey: ["cancel-parser"], queryFn: network, meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser } })
		).rejects.toBeDefined();
		await waitForScheduledPersistence();
		expect(parser).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
		expect(second.getQueryData(["cancel-parser"])).toBeUndefined();
		expect((await storage.getItem(saved[0]))?.state.data).toBe("stored");
		const next = createQueryClient({});
		expect(await next.fetchQuery({ queryKey: ["cancel-parser"], queryFn: network, meta: policy })).toBe("stored");
		expect(network).not.toHaveBeenCalled();
	});

	it("смена session scope во время parser отменяет publication и старый network fallback", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "changing-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["changing-parser"], queryFn: async () => "stored", meta: policy });
		await waitForScheduledPersistence();
		const second = createQueryClient({});
		const network = vi.fn(async () => "network");
		let transition: Promise<void> | undefined;
		const parser = vi.fn(() => {
			transition = setSessionQueryPersistenceScope({ id: "changed-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
			return "parsed";
		});
		await expect(
			second.fetchQuery({
				queryKey: ["changing-parser"],
				queryFn: network,
				meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser }
			})
		).rejects.toBeDefined();
		await transition;
		await waitForScheduledPersistence();
		expect(parser).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
		expect(second.getQueryData(["changing-parser"])).toBeUndefined();
	});

	it.each([false, true])("microtask смены scope не публикует старый restore при refetchOnRestore=%s", async (refetchOnRestore) => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "microtask-parser-a", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore });
		const queryKey = ["microtask-scope-change"] as const;
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey, queryFn: async () => "old-private-data", meta: policy });
		await waitForScheduledPersistence();
		const second = createQueryClient({});
		const network = vi.fn(async () => "new-private-data");
		let transition: Promise<void> | undefined;
		const parser = vi.fn(() => {
			queueMicrotask(() => {
				transition = setSessionQueryPersistenceScope({ id: "microtask-parser-b", expiresAt: "2099-01-01T00:00:00.000Z" });
			});
			return "old-private-data";
		});
		await expect(
			second.fetchQuery({ queryKey, queryFn: network, meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser } })
		).rejects.toBeDefined();
		await transition;
		await waitForScheduledPersistence();
		expect(second.getQueryData(queryKey)).toBeUndefined();
		expect(second.getQueryState(queryKey)?.dataUpdatedAt).toBe(0);
		expect(parser).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});

	it("scheduled restore не отменяет microtask cancellation повторным refetch", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "microtask-cancel-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4 });
		const queryKey = ["microtask-cancel-parser"] as const;
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey, queryFn: async () => "valid-cache", meta: policy });
		await waitForScheduledPersistence();
		const second = createQueryClient({});
		const network = vi.fn(async () => "network");
		const parser = vi.fn(() => {
			if (parser.mock.calls.length === 1) queueMicrotask(() => void second.cancelQueries({ queryKey, exact: true }));
			return "valid-cache";
		});
		await expect(
			second.fetchQuery({ queryKey, queryFn: network, meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser } })
		).rejects.toBeDefined();
		await waitForScheduledPersistence();
		expect(second.getQueryData(queryKey)).toBeUndefined();
		expect(second.getQueryState(queryKey)?.dataUpdatedAt).toBe(0);
		expect(parser).toHaveBeenCalledTimes(1);
		expect(network).not.toHaveBeenCalled();
	});

	it("поздний restore scheduler не откатывает timestamp нового чтения с теми же data", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "superseded-parser", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4 });
		const queryKey = ["superseded-parser"] as const;
		const shared = Object.freeze({ value: "same-data" });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey, queryFn: async () => shared, meta: policy });
		await waitForScheduledPersistence();
		const storage = createIndexedDbQueryStorage<PersistedQuery>();
		if (!storage) throw new Error("IndexedDB storage не создан");
		const saved = (await storage.entries()).find(([, entry]) => entry.queryKey[0] === queryKey[0]);
		if (!saved) throw new Error("Persisted запись не сохранена");
		const oldTimestamp = Date.now() - 60_000;
		await storage.setItem(saved[0], { ...saved[1], state: { ...saved[1].state, dataUpdatedAt: oldTimestamp } });
		const second = createQueryClient({});
		const parser = vi.fn(() => shared);
		const meta = { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser };
		expect(await second.fetchQuery({ queryKey, queryFn: async () => shared, meta })).toBe(shared);
		const network = vi.fn(async () => shared);
		expect(await second.fetchQuery({ queryKey, queryFn: network, meta, staleTime: 0 })).toBe(shared);
		const newTimestamp = second.getQueryState(queryKey)?.dataUpdatedAt;
		await waitForScheduledPersistence();
		expect(second.getQueryData(queryKey)).toBe(shared);
		expect(newTimestamp).toBeGreaterThan(oldTimestamp);
		expect(second.getQueryState(queryKey)?.dataUpdatedAt).toBe(newTimestamp);
		expect(parser).toHaveBeenCalledTimes(1);
		expect(network).toHaveBeenCalledTimes(1);
	});

	it("сохраняет session isolation при подключённом restore parser", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		await setSessionQueryPersistenceScope({ id: "parser-session-a", expiresAt: "2099-01-01T00:00:00.000Z" });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["isolated-parser"], queryFn: async () => "first-session", meta: policy });
		await waitForScheduledPersistence();
		await setSessionQueryPersistenceScope({ id: "parser-session-b", expiresAt: "2099-01-01T00:00:00.000Z" });
		const parser = vi.fn(() => "parsed");
		const second = createQueryClient({});
		expect(
			await second.fetchQuery({
				queryKey: ["isolated-parser"],
				queryFn: async () => "second-session",
				meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser }
			})
		).toBe("second-session");
		expect(parser).not.toHaveBeenCalled();
	});

	it.each([undefined, Promise.resolve("async")])("отклоняет parser result %s до publication", async (result) => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: `invalid-parser-${typeof result}`, expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["invalid-parser-result"], queryFn: async () => "stored", meta: policy });
		await waitForScheduledPersistence();
		const second = createQueryClient({});
		expect(
			await second.fetchQuery({
				queryKey: ["invalid-parser-result"],
				queryFn: async () => "network",
				meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: () => result }
			})
		).toBe("network");
	});

	it.each(["rejected-promise", "callable-thenable"])("отклоняет %s без unhandled rejection", async (invalidResult) => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: `parser-${invalidResult}`, expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["invalid-async-parser"], queryFn: async () => "stored", meta: policy });
		await waitForScheduledPersistence();
		const second = createQueryClient({});
		const parser = () => {
			if (invalidResult === "rejected-promise") return Promise.reject(new Error("Неподдерживаемый async parser."));
			return Object.assign(() => undefined, { then: (resolve: (value: string) => void) => resolve("async") });
		};
		expect(
			await second.fetchQuery({
				queryKey: ["invalid-async-parser"],
				queryFn: async () => "network",
				meta: { ...policy, [QUERY_RESTORED_DATA_PARSER]: parser }
			})
		).toBe("network");
		await waitForScheduledPersistence();
	});

	it("не проглатывает network error после отклонённого restore", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "parser-network-error", expiresAt: "2099-01-01T00:00:00.000Z" });
		const policy = createSessionQueryPersistenceMeta({ cacheName: "parsed", maxEntries: 4, refetchOnRestore: false });
		const first = createQueryClient({});
		await first.fetchQuery({ queryKey: ["parser-network-error"], queryFn: async () => "stored", meta: policy });
		await waitForScheduledPersistence();
		const second = createQueryClient({});
		const error = new Error("Network read failed.");
		await expect(
			second.fetchQuery({
				queryKey: ["parser-network-error"],
				queryFn: async () => {
					throw error;
				},
				meta: {
					...policy,
					[QUERY_RESTORED_DATA_PARSER]: () => {
						throw new Error("Некорректная persisted форма.");
					}
				}
			})
		).rejects.toBe(error);
		expect(second.getQueryData(["parser-network-error"])).toBeUndefined();
	});

	it("отклоняет неправильно настроенный hook вместо доверия persisted форме", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		const client = createQueryClient({});
		await expect(
			client.fetchQuery({
				queryKey: ["invalid-hook"],
				queryFn: async () => "network",
				meta: { ...persistedQueryMeta, [QUERY_RESTORED_DATA_PARSER]: "invalid" as never }
			})
		).rejects.toThrow(TypeError);
	});
});
