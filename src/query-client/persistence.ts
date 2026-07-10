import { experimental_createQueryPersister, type AsyncStorage, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { type Query } from "@tanstack/react-query";

import { getQueryPersistenceProjectAdapter } from "./queryPersistenceAdapter";

const STORE_NAME = "queries";

export const REACT_QUERY_PERSISTENCE_BUSTER = __REACT_QUERY_PERSISTENCE_BUSTER__;
export const REACT_QUERY_PERSISTENCE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

type IndexedDbQueryStorageOptions = {
	dbName?: string;
	storeName?: string;
	indexedDB?: IDBFactory;
};

function resolveIndexedDbFactory(factory?: IDBFactory) {
	if (factory) return factory;
	if (typeof globalThis.indexedDB === "undefined") return undefined;
	return globalThis.indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>) {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function getSystemIdentifier() {
	if (__DEV__) {
		return `dev:${__APP_ID__}`;
	}

	const projectIdentifier = getQueryPersistenceProjectAdapter().resolveSystemIdentifier?.();
	if (projectIdentifier) return projectIdentifier;

	const hostname = typeof window === "undefined" ? "server" : window.location.hostname;
	return `${__APP_ID__}:${hostname}`;
}

function getPersistencePrefix() {
	const system = getSystemIdentifier();
	return `${system}`;
}

export function shouldPersistQuery(query: Pick<Query, "meta">) {
	return query.meta?.persist === true && query.meta.sessionScoped !== true;
}

export function createIndexedDbQueryStorage<TStorageValue = unknown>(
	options: IndexedDbQueryStorageOptions = {}
): AsyncStorage<TStorageValue> | undefined {
	const factory = resolveIndexedDbFactory(options.indexedDB);
	if (!factory) return undefined;

	const idb = factory;
	const dbName = options.dbName ?? getSystemIdentifier();
	const storeName = options.storeName ?? STORE_NAME;
	let dbPromise: Promise<IDBDatabase> | null = null;

	function openDb() {
		if (dbPromise) return dbPromise;

		dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
			const request = idb.open(dbName, 1);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName);
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
			request.onblocked = () => reject(request.error ?? new Error("Открытие IndexedDB заблокировано"));
		});

		return dbPromise;
	}

	async function runTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
		const db = await openDb();
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);
		const request = action(store);
		return requestToPromise(request);
	}

	async function runWrite(mode: IDBTransactionMode, action: (store: IDBObjectStore) => void) {
		const db = await openDb();

		return new Promise<void>((resolve, reject) => {
			const tx = db.transaction(storeName, mode);
			const store = tx.objectStore(storeName);

			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);

			try {
				action(store);
			} catch (error) {
				tx.abort();
				reject(error);
			}
		});
	}

	return {
		getItem: (key) => runTransaction<TStorageValue | undefined>("readonly", (store) => store.get(key)),
		setItem: (key, value) => runWrite("readwrite", (store) => store.put(value, key)),
		removeItem: (key) => runWrite("readwrite", (store) => store.delete(key)),
		entries: async () => {
			const db = await openDb();

			return new Promise<Array<[key: string, value: TStorageValue]>>((resolve, reject) => {
				const tx = db.transaction(storeName, "readonly");
				const store = tx.objectStore(storeName);
				const request = store.openCursor();
				const entries: Array<[key: string, value: TStorageValue]> = [];

				tx.oncomplete = () => resolve(entries);
				tx.onerror = () => reject(tx.error);
				tx.onabort = () => reject(tx.error);

				request.onsuccess = () => {
					const cursor = request.result;
					if (!cursor) return;

					entries.push([String(cursor.key), cursor.value as TStorageValue]);
					cursor.continue();
				};
				request.onerror = () => reject(request.error);
			});
		}
	};
}

export function createReactQueryPersister() {
	const storage = createIndexedDbQueryStorage<PersistedQuery>();
	if (!storage) return undefined;

	return experimental_createQueryPersister<PersistedQuery>({
		storage,
		serialize: (query) => query,
		deserialize: (query) => query,
		prefix: getPersistencePrefix(),
		buster: getQueryPersistenceProjectAdapter().persistenceBuster ?? REACT_QUERY_PERSISTENCE_BUSTER,
		maxAge: REACT_QUERY_PERSISTENCE_MAX_AGE,
		refetchOnRestore: true,
		filters: { predicate: shouldPersistQuery }
	});
}
