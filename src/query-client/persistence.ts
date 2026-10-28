import { experimental_createQueryPersister, type AsyncStorage, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { CancelledError, type Query, type QueryFunction, type QueryFunctionContext, type QueryKey } from "@tanstack/react-query";

import { createQueryRestoreSchedulerGuard } from "./createQueryRestoreSchedulerGuard";
import { createQueryRestoreStorage } from "./createQueryRestoreStorage";
import { QUERY_RESTORED_DATA_PARSER } from "./queryMeta";
import { getQueryPersistenceProjectAdapter } from "./queryPersistenceAdapter";
import {
	SESSION_QUERY_CACHE_MAX_ENTRIES,
	SESSION_QUERY_CACHE_NAME_PATTERN,
	SESSION_QUERY_REVISION_FIELD_PATTERN
} from "./sessionPersistenceConstants";

const STORE_NAME = "queries";
const SESSION_PERSISTENCE_MARKER = "session";

const INDEXED_DB_ACTION_KEEP = "keep";
const INDEXED_DB_ACTION_SET = "set";
const INDEXED_DB_ACTION_REMOVE = "remove";
const INDEXED_DB_MODE_READ_WRITE = "readwrite";
const INDEXED_DB_MODE_READ_ONLY = "readonly";
const INDEXED_DB_SCHEMA_VERSION = 1;

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
	| { readonly action: typeof INDEXED_DB_ACTION_KEEP; readonly result: TResult }
	| { readonly action: typeof INDEXED_DB_ACTION_SET; readonly value: TStorageValue; readonly result: TResult }
	| { readonly action: typeof INDEXED_DB_ACTION_REMOVE; readonly result: TResult };

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

function resolveIndexedDbFactory(factory?: IDBFactory): IDBFactory | undefined {
	if (factory) return factory;
	try {
		return globalThis.indexedDB;
	} catch {
		// Сам getter может выбросить SecurityError из-за политики браузера.
		// Недоступный необязательный кэш не должен срывать создание QueryClient;
		// ошибки операций уже полученной фабрики по-прежнему передаются потребителю.
		return undefined;
	}
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
	if (typeof policy.cacheName !== "string" || !SESSION_QUERY_CACHE_NAME_PATTERN.test(policy.cacheName)) return null;
	if (!Number.isSafeInteger(policy.maxEntries) || policy.maxEntries < 1 || policy.maxEntries > SESSION_QUERY_CACHE_MAX_ENTRIES)
		return null;
	const refetchOnRestore = "refetchOnRestore" in policy ? policy.refetchOnRestore : undefined;
	if (refetchOnRestore !== undefined && typeof refetchOnRestore !== "boolean") return null;
	const monotonicRevisionField = "monotonicRevisionField" in policy ? policy.monotonicRevisionField : undefined;
	if (
		monotonicRevisionField !== undefined &&
		(typeof monotonicRevisionField !== "string" || !SESSION_QUERY_REVISION_FIELD_PATTERN.test(monotonicRevisionField))
	) {
		return null;
	}
	return { cacheName: policy.cacheName, maxEntries: policy.maxEntries, refetchOnRestore, monotonicRevisionField } as const;
}

function readMonotonicDecimalRevision(query: PersistedQuery, field: string): string | null {
	const data = query.state.data;
	if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
	const revision = Reflect.get(data, field);
	if (typeof revision !== "string" || !/^\d+$/u.test(revision)) return null;
	return revision.replace(/^0+(?=\d)/u, "");
}

function compareDecimalRevisions(left: string, right: string): number {
	if (left.length !== right.length) return left.length - right.length;
	if (left === right) return 0;
	return left < right ? -1 : 1;
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
			const request = idb.open(dbName, INDEXED_DB_SCHEMA_VERSION);

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
			const tx = db.transaction(storeName, INDEXED_DB_MODE_READ_WRITE);
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
					if (decision.action === INDEXED_DB_ACTION_SET) store.put(decision.value, key);
					else if (decision.action === INDEXED_DB_ACTION_REMOVE) store.delete(key);
				} catch (error) {
					tx.abort();
					reject(error);
				}
			};
		});
	}

	return {
		getItem: (key) => runTransaction<TStorageValue | undefined>(INDEXED_DB_MODE_READ_ONLY, (store) => store.get(key)),
		setItem: (key, value) => runWrite(INDEXED_DB_MODE_READ_WRITE, (store) => store.put(value, key)),
		removeItem: (key) => runWrite(INDEXED_DB_MODE_READ_WRITE, (store) => store.delete(key)),
		updateItem,
		entries: async () => {
			const db = await openDb();

			return new Promise<Array<[key: string, value: TStorageValue]>>((resolve, reject) => {
				const tx = db.transaction(storeName, INDEXED_DB_MODE_READ_ONLY);
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
	const sessionPersisters = new Map<
		string,
		Readonly<{
			persister: ReturnType<typeof experimental_createQueryPersister<PersistedQuery>>;
			storage: AsyncStorage<PersistedQuery>;
			prefix: string;
		}>
	>();
	// Token относится только к opt-in операции. WeakMap не удерживает удалённые
	// Query и не хранит callbacks/data; поздний scheduler узнаёт новую операцию.
	const restoreOperations = new WeakMap<Query, object>();

	function getSessionPersister(
		scope: SessionQueryPersistenceScope,
		cacheName: string,
		maxEntries: number,
		refetchOnRestore = true,
		monotonicRevisionField?: string
	) {
		const prefix = getSessionPersistenceCachePrefix(scope.id, cacheName);
		const identity = `${prefix}:${maxEntries}:${refetchOnRestore}:${monotonicRevisionField ?? ""}:${scope.expiresAt}`;
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

				if (monotonicRevisionField === undefined) {
					await indexedDbStorage.setItem(key, value);
				} else {
					await indexedDbStorage.updateItem(key, (stored) => {
						if (!stored || stored.buster !== value.buster) return { action: INDEXED_DB_ACTION_SET, value, result: undefined };
						const storedRevision = readMonotonicDecimalRevision(stored, monotonicRevisionField);
						const nextRevision = readMonotonicDecimalRevision(value, monotonicRevisionField);
						if (storedRevision !== null && nextRevision !== null && compareDecimalRevisions(storedRevision, nextRevision) > 0) {
							return { action: INDEXED_DB_ACTION_KEEP, result: undefined };
						}
						return { action: INDEXED_DB_ACTION_SET, value, result: undefined };
					});
				}
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
			refetchOnRestore,
			filters: {
				predicate: (query) => readSessionQueryPersistencePolicy(query)?.cacheName === cacheName
			}
		});
		const entry = { persister, storage: boundedStorage, prefix };
		sessionPersisters.set(identity, entry);
		return entry;
	}

	return {
		...publicPersister,
		async persisterFn<T, TQueryKey extends QueryKey>(
			queryFn: QueryFunction<T, TQueryKey>,
			context: QueryFunctionContext<TQueryKey>,
			query: Query
		): Promise<T> {
			const policy = readSessionQueryPersistencePolicy(query);
			const scope = getSessionQueryPersistenceScope();
			if (policy && !scope) return Promise.resolve(queryFn(context));
			const source =
				policy && scope
					? getSessionPersister(
							scope,
							policy.cacheName,
							policy.maxEntries,
							policy.refetchOnRestore,
							policy.monotonicRevisionField
						)
					: { persister: publicPersister, storage: indexedDbStorage, prefix: getPersistencePrefix() };
			const parser = query.meta?.[QUERY_RESTORED_DATA_PARSER];
			if (parser === undefined) {
				restoreOperations.delete(query);
				return source.persister.persisterFn(queryFn, context, query);
			}
			if (typeof parser !== "function") throw new TypeError("Parser восстановленных Query data должен быть функцией.");

			const operation = {};
			restoreOperations.set(query, operation);
			const assertCurrentRestore = () => {
				if (
					context.signal.aborted ||
					restoreOperations.get(query) !== operation ||
					(policy && getSessionQueryPersistenceScope()?.id !== scope?.id)
				) {
					throw new CancelledError({ revert: true });
				}
			};
			const buster = getQueryPersistenceProjectAdapter().persistenceBuster ?? REACT_QUERY_PERSISTENCE_BUSTER;
			// Adapter принадлежит одному обращению, а общий storage продолжает владеть
			// monotonic writes и pruneQueue. Callback не сохраняется в session factory.
			const restoreStorage = createQueryRestoreStorage({
				storage: source.storage,
				queryHash: query.queryHash,
				prefix: source.prefix,
				buster,
				maxAge: REACT_QUERY_PERSISTENCE_MAX_AGE,
				parser,
				assertCurrentRestore
			});
			const restorePersister = experimental_createQueryPersister<PersistedQuery>({
				storage: restoreStorage,
				serialize: (stored) => stored,
				deserialize: (stored) => stored,
				prefix: source.prefix,
				buster,
				maxAge: REACT_QUERY_PERSISTENCE_MAX_AGE,
				refetchOnRestore: policy?.refetchOnRestore ?? true,
				filters: policy
					? { predicate: (target) => readSessionQueryPersistencePolicy(target)?.cacheName === policy.cacheName }
					: { predicate: shouldPersistQuery }
			});
			const result = await restorePersister.persisterFn(
				(currentContext) => {
					// Upstream превращает restore errors в обычный fallback. После cancel
					// или смены сессии этот fallback не должен запускать старый queryFn.
					assertCurrentRestore();
					return queryFn(currentContext);
				},
				context,
				createQueryRestoreSchedulerGuard({ query, assertCurrentRestore })
			);
			// Await внутри upstream открывает новую microtask boundary. Scope мог
			// смениться уже после последней проверки в storage/parser.
			assertCurrentRestore();
			return result;
		}
	};
}
