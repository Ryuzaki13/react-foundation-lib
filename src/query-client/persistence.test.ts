import { experimental_createQueryPersister, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { QueryClient, type Query, type QueryFunctionContext, type QueryState } from "@tanstack/react-query";
import { indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { createIndexedDbQueryStorage, REACT_QUERY_PERSISTENCE_BUSTER, shouldPersistQuery } from "./persistence";
import { createQueryClient } from "./queryClient";
import { persistedQueryMeta, sessionScopedQueryMeta } from "./queryMeta";

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

afterEach(() => {
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

	it("выбирает для сохранения только query с meta.persist = true", async () => {
		expect(shouldPersistQuery(createQueryMock("enabled", persistedQueryMeta))).toBe(true);
		expect(shouldPersistQuery(createQueryMock("disabled", undefined))).toBe(false);
		expect(shouldPersistQuery(createQueryMock("disabled-meta", { persist: false }))).toBe(false);
		expect(shouldPersistQuery(createQueryMock("session", sessionScopedQueryMeta))).toBe(false);
		expect(shouldPersistQuery(createQueryMock("conflicting", { persist: true, sessionScoped: true }))).toBe(false);
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
});
