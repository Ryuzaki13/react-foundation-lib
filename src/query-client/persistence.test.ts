import { experimental_createQueryPersister, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { QueryClient, type Query, type QueryFunctionContext, type QueryState } from "@tanstack/react-query";
import { indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import {
	clearSessionQueryPersistence,
	createIndexedDbQueryStorage,
	getSessionQueryPersistenceScope,
	REACT_QUERY_PERSISTENCE_BUSTER,
	setSessionQueryPersistenceScope,
	shouldPersistQuery
} from "./persistence";
import { createQueryClient } from "./queryClient";
import { createSessionQueryPersistenceMeta, persistedQueryMeta, sessionScopedQueryMeta } from "./queryMeta";

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

	it("не активирует истёкший scope и очищает его browser storage", async () => {
		Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });
		await setSessionQueryPersistenceScope({ id: "expired", expiresAt: "2000-01-01T00:00:00.000Z" });

		expect(getSessionQueryPersistenceScope()).toBeNull();
		await expect(clearSessionQueryPersistence("expired")).resolves.toBeUndefined();
	});
});
