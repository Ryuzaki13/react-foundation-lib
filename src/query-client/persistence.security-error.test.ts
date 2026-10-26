import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createIndexedDbQueryStorage, setSessionQueryPersistenceScope } from "./persistence";
import { createQueryClient } from "./queryClient";
import { createSessionQueryPersistenceMeta, persistedQueryMeta } from "./queryMeta";

const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");

beforeEach(() => {
	// Браузер с ограничениями может отклонить уже чтение свойства, до вызова open().
	Object.defineProperty(globalThis, "indexedDB", {
		configurable: true,
		get() {
			throw new DOMException("Доступ к IndexedDB запрещён.", "SecurityError");
		}
	});
});

afterEach(async () => {
	vi.restoreAllMocks();
	if (originalIndexedDbDescriptor) Object.defineProperty(globalThis, "indexedDB", originalIndexedDbDescriptor);
	else Reflect.deleteProperty(globalThis, "indexedDB");
	await setSessionQueryPersistenceScope(null);
});

describe("query-client при запрещённом доступе к IndexedDB", () => {
	it.each([
		{ kind: "публичный", meta: persistedQueryMeta },
		{ kind: "сессионный", meta: createSessionQueryPersistenceMeta({ cacheName: "blocked-storage", maxEntries: 2 }) }
	])("загружает $kind query и повторно использует кэш в памяти", async ({ meta }) => {
		const onQueryError = vi.fn();
		const client = createQueryClient({ onQueryError });
		try {
			await setSessionQueryPersistenceScope({ id: "blocked-storage-session", expiresAt: "2099-01-01T00:00:00.000Z" });
			const queryFn = vi.fn(async () => "Ответ сервера");
			const options = { queryKey: ["blocked-storage"], queryFn, meta };

			expect(client.getDefaultOptions().queries?.persister).toBeUndefined();
			await expect(client.fetchQuery(options)).resolves.toBe("Ответ сервера");
			await expect(client.fetchQuery(options)).resolves.toBe("Ответ сервера");
			expect(queryFn).toHaveBeenCalledOnce();
			expect(client.getQueryData(options.queryKey)).toBe("Ответ сервера");
			expect(onQueryError).not.toHaveBeenCalled();
		} finally {
			client.clear();
		}
	});

	it("использует явно переданную фабрику при запрещённом глобальном доступе", async () => {
		const storage = createIndexedDbQueryStorage<string>({ indexedDB: new IDBFactory(), dbName: "explicit-storage" });
		if (!storage) throw new Error("Явная IndexedDB factory не создала storage.");

		await storage.setItem("key", "Сохранённое значение");
		await expect(storage.getItem("key")).resolves.toBe("Сохранённое значение");
		await storage.removeItem("key");
		await expect(storage.getItem("key")).resolves.toBeUndefined();
	});

	it("сохраняет отказ операций, если доступная фабрика запрещает открытие базы", async () => {
		const factory = new IDBFactory();
		const error = new DOMException("Открытие IndexedDB запрещено.", "SecurityError");
		vi.spyOn(factory, "open").mockImplementation(() => {
			throw error;
		});
		const storage = createIndexedDbQueryStorage<string>({ indexedDB: factory, dbName: "denied-open" });
		if (!storage) throw new Error("Явная IndexedDB factory не создала storage.");

		await expect(storage.getItem("key")).rejects.toBe(error);
		await expect(storage.setItem("key", "Значение")).rejects.toBe(error);
	});
});
