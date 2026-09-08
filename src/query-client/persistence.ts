import { experimental_createQueryPersister, type AsyncStorage, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { type Query, type QueryFunction, type QueryFunctionContext, type QueryKey } from "@tanstack/react-query";

import { getQueryPersistenceProjectAdapter } from "./queryPersistenceAdapter";

const STORE_NAME = "queries";
const SESSION_PERSISTENCE_MARKER = "session";

export const REACT_QUERY_PERSISTENCE_BUSTER = __REACT_QUERY_PERSISTENCE_BUSTER__;
export const REACT_QUERY_PERSISTENCE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

type IndexedDbQueryStorageOptions = {
	dbName?: string;
	storeName?: string;
	indexedDB?: IDBFactory;
};

export type SessionQueryPersistenceScope = {
	/** Публичная identity серверной сессии; cookie secret или access token здесь недопустимы. */
	readonly id: string;
	/** Абсолютная граница, после которой snapshots этой сессии нельзя читать или записывать. */
	readonly expiresAt: string;
};

let activeSessionPersistenceScope: SessionQueryPersistenceScope | null = null;

/**
 * Описывает итог синхронного преобразования записи внутри одной IndexedDB-транзакции.
 * Отдельный result позволяет вернуть вызывающему коду вычисленный снимок только после commit.
 */
export type IndexedDbAtomicUpdateDecision<TStorageValue, TResult> =
	| { readonly action: "keep"; readonly result: TResult }
	| { readonly action: "set"; readonly value: TStorageValue; readonly result: TResult }
	| { readonly action: "remove"; readonly result: TResult };

export type IndexedDbQueryStorage<TStorageValue> = AsyncStorage<TStorageValue> & {
	/** Перечисляет записи object store для garbage collection и bounded persistence. */
	readonly entries: () => Promise<Array<[key: string, value: TStorageValue]>>;
	/**
	 * Читает и изменяет одну запись в общей readwrite-транзакции, поэтому параллельные
	 * вкладки не могут потерять уже зафиксированное изменение между get и set.
	 * Callback должен быть синхронным: IndexedDB закрывает неактивную транзакцию до
	 * завершения произвольной асинхронной работы.
	 */
	readonly updateItem: <TResult>(
		key: string,
		update: (value: TStorageValue | undefined) => IndexedDbAtomicUpdateDecision<TStorageValue, TResult>
	) => Promise<TResult>;
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

function encodePersistenceSegment(value: string) {
	return encodeURIComponent(value);
}

function getSessionPersistenceRootPrefix() {
	return `${getPersistencePrefix()}-${SESSION_PERSISTENCE_MARKER}-`;
}

function getSessionPersistenceScopePrefix(scopeId: string) {
	return `${getSessionPersistenceRootPrefix()}${encodePersistenceSegment(scopeId)}-`;
}

function getSessionPersistenceCachePrefix(scopeId: string, cacheName: string) {
	return `${getSessionPersistenceScopePrefix(scopeId)}${encodePersistenceSegment(cacheName)}`;
}

function isSessionPersistenceScopeValid(scope: SessionQueryPersistenceScope | null): scope is SessionQueryPersistenceScope {
	return (
		Boolean(scope?.id.trim()) && Number.isFinite(Date.parse(scope?.expiresAt ?? "")) && Date.parse(scope?.expiresAt ?? "") > Date.now()
	);
}

/** Возвращает текущую browser-session identity, которой разрешено читать приватные persisted query. */
export function getSessionQueryPersistenceScope(): SessionQueryPersistenceScope | null {
	return isSessionPersistenceScopeValid(activeSessionPersistenceScope) ? activeSessionPersistenceScope : null;
}

async function removeSessionPersistenceEntries(predicate: (key: string) => boolean) {
	const storage = createIndexedDbQueryStorage<PersistedQuery>();
	if (!storage?.entries) return;

	const entries = await storage.entries();
	await Promise.all(entries.filter(([key]) => predicate(key)).map(([key]) => storage.removeItem(key)));
}

/** Удаляет persisted query одной сессии или всех сессий текущего приложения. */
export async function clearSessionQueryPersistence(scopeId?: string): Promise<void> {
	const prefix = scopeId === undefined ? getSessionPersistenceRootPrefix() : getSessionPersistenceScopePrefix(scopeId);
	await removeSessionPersistenceEntries((key) => key.startsWith(prefix));
}

/**
 * Устанавливает единственную активную server-session identity и сразу исключает
 * чтение старого scope. Browser storage очищается асинхронно уже после смены
 * in-memory границы, поэтому параллельный query не может записаться старому пользователю.
 */
export async function setSessionQueryPersistenceScope(scope: SessionQueryPersistenceScope | null): Promise<void> {
	const normalized = scope && isSessionPersistenceScopeValid(scope) ? { id: scope.id.trim(), expiresAt: scope.expiresAt } : null;
	activeSessionPersistenceScope = normalized;

	if (!normalized) {
		await clearSessionQueryPersistence();
		return;
	}

	const activePrefix = getSessionPersistenceScopePrefix(normalized.id);
	await removeSessionPersistenceEntries((key) => key.startsWith(getSessionPersistenceRootPrefix()) && !key.startsWith(activePrefix));
}

export function shouldPersistQuery(query: Pick<Query, "meta">) {
	return query.meta?.persist === true && query.meta.sessionScoped !== true;
}

function readSessionQueryPersistencePolicy(query: Pick<Query, "meta">) {
	const policy = query.meta?.sessionPersistence;
	if (query.meta?.sessionScoped !== true || !policy || typeof policy !== "object") return null;
	if (!("cacheName" in policy) || !("maxEntries" in policy)) return null;
	if (typeof policy.cacheName !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(policy.cacheName)) return null;
	if (!Number.isSafeInteger(policy.maxEntries) || policy.maxEntries < 1 || policy.maxEntries > 5_000) return null;
	return { cacheName: policy.cacheName, maxEntries: policy.maxEntries } as const;
}

export function createIndexedDbQueryStorage<TStorageValue = unknown>(
	options: IndexedDbQueryStorageOptions = {}
): IndexedDbQueryStorage<TStorageValue> | undefined {
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

	async function updateItem<TResult>(
		key: string,
		update: (value: TStorageValue | undefined) => IndexedDbAtomicUpdateDecision<TStorageValue, TResult>
	) {
		const db = await openDb();
		return new Promise<TResult>((resolve, reject) => {
			const tx = db.transaction(storeName, "readwrite");
			const store = tx.objectStore(storeName);
			const request = store.get(key);
			let result: TResult;
			let hasResult = false;

			tx.oncomplete = () => {
				if (hasResult) resolve(result);
				else reject(new Error("IndexedDB-транзакция завершилась без результата обновления"));
			};
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
			request.onerror = () => {
				tx.abort();
				reject(request.error);
			};
			request.onsuccess = () => {
				try {
					const decision = update(request.result as TStorageValue | undefined);
					result = decision.result;
					hasResult = true;
					if (decision.action === "set") store.put(decision.value, key);
					else if (decision.action === "remove") store.delete(key);
				} catch (error) {
					tx.abort();
					reject(error);
				}
			};
		});
	}

	return {
		getItem: (key) => runTransaction<TStorageValue | undefined>("readonly", (store) => store.get(key)),
		setItem: (key, value) => runWrite("readwrite", (store) => store.put(value, key)),
		removeItem: (key) => runWrite("readwrite", (store) => store.delete(key)),
		updateItem,
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
	const indexedDbStorage = storage;

	const publicPersister = experimental_createQueryPersister<PersistedQuery>({
		storage: indexedDbStorage,
		serialize: (query) => query,
		deserialize: (query) => query,
		prefix: getPersistencePrefix(),
		buster: getQueryPersistenceProjectAdapter().persistenceBuster ?? REACT_QUERY_PERSISTENCE_BUSTER,
		maxAge: REACT_QUERY_PERSISTENCE_MAX_AGE,
		refetchOnRestore: true,
		filters: { predicate: shouldPersistQuery }
	});
	const sessionPersisters = new Map<string, ReturnType<typeof experimental_createQueryPersister<PersistedQuery>>>();

	function getSessionPersister(scope: SessionQueryPersistenceScope, cacheName: string, maxEntries: number) {
		const prefix = getSessionPersistenceCachePrefix(scope.id, cacheName);
		const identity = `${prefix}:${maxEntries}:${scope.expiresAt}`;
		const existing = sessionPersisters.get(identity);
		if (existing) return existing;

		let pruneQueue = Promise.resolve();
		const boundedStorage: AsyncStorage<PersistedQuery> = {
			getItem: (key) => {
				const activeScope = getSessionQueryPersistenceScope();
				return activeScope?.id === scope.id ? indexedDbStorage.getItem(key) : undefined;
			},
			removeItem: (key) => indexedDbStorage.removeItem(key),
			entries: () => indexedDbStorage.entries(),
			setItem: async (key, value) => {
				const activeScope = getSessionQueryPersistenceScope();
				if (activeScope?.id !== scope.id) return;

				await indexedDbStorage.setItem(key, value);
				pruneQueue = pruneQueue.then(async () => {
					const entries = (await indexedDbStorage.entries()).filter(([entryKey]) => entryKey.startsWith(`${prefix}-`));
					entries.sort((left, right) => (right[1].state.dataUpdatedAt ?? 0) - (left[1].state.dataUpdatedAt ?? 0));
					await Promise.all(entries.slice(maxEntries).map(([entryKey]) => indexedDbStorage.removeItem(entryKey)));
				});
				await pruneQueue;
			}
		};
		const persister = experimental_createQueryPersister<PersistedQuery>({
			storage: boundedStorage,
			serialize: (query) => query,
			deserialize: (query) => query,
			prefix,
			buster: getQueryPersistenceProjectAdapter().persistenceBuster ?? REACT_QUERY_PERSISTENCE_BUSTER,
			maxAge: REACT_QUERY_PERSISTENCE_MAX_AGE,
			refetchOnRestore: true,
			filters: {
				predicate: (query) => readSessionQueryPersistencePolicy(query)?.cacheName === cacheName
			}
		});
		sessionPersisters.set(identity, persister);
		return persister;
	}

	return {
		...publicPersister,
		async persisterFn<T, TQueryKey extends QueryKey>(
			queryFn: QueryFunction<T, TQueryKey>,
			context: QueryFunctionContext<TQueryKey>,
			query: Query
		): Promise<T> {
			const policy = readSessionQueryPersistencePolicy(query);
			if (!policy) return publicPersister.persisterFn(queryFn, context, query);

			const scope = getSessionQueryPersistenceScope();
			if (!scope) return Promise.resolve(queryFn(context));

			return getSessionPersister(scope, policy.cacheName, policy.maxEntries).persisterFn(queryFn, context, query);
		}
	};
}
