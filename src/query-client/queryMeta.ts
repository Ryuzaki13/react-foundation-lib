import { type QueryMeta } from "@tanstack/react-query";

export type SessionQueryPersistencePolicy = {
	/** Устойчивое предметно независимое имя bounded-кэша внутри текущей сессии. */
	readonly cacheName: string;
	/** Максимальное число последних успешно полученных query в этом кэше. */
	readonly maxEntries: number;
	/**
	 * По умолчанию восстановленный snapshot сразу перепроверяется полным queryFn.
	 * `false` допустим только при наличии отдельной лёгкой проверки актуальности.
	 */
	readonly refetchOnRestore?: boolean;
	/**
	 * Поле верхнего уровня query data с неотрицательной целочисленной ревизией.
	 * При наличии поля IndexedDB атомарно отклоняет запоздавшую запись меньшей
	 * ревизии, поэтому параллельная вкладка не может откатить сохранённый snapshot.
	 */
	readonly monotonicRevisionField?: string;
};

/**
 * Общие признаки query, которые управляют инфраструктурой клиентского кеша.
 *
 * `persist` разрешает долговременное хранение публичных справочных данных,
 * а `sessionScoped` помечает данные, доступность или содержимое которых зависит
 * от текущей серверной сессии. Эти признаки нельзя совмещать. Отдельный
 * `sessionPersistence` разрешает bounded storage только внутри активного scope.
 */
export type AppQueryMeta = {
	readonly persist?: boolean;
	readonly sessionScoped?: boolean;
	readonly sessionPersistence?: SessionQueryPersistencePolicy;
} & Record<string, unknown>;

declare module "@tanstack/react-query" {
	interface Register {
		queryMeta: AppQueryMeta;
	}
}

/** Разрешает сохранять публичную query в долговременном хранилище. */
export const persistedQueryMeta = { persist: true } as const satisfies QueryMeta;

/** Помечает query для сброса при изменении серверной сессии. */
export const sessionScopedQueryMeta = { sessionScoped: true } as const satisfies QueryMeta;

/**
 * Разрешает bounded persistence только внутри явно установленной server-session identity.
 * Scope и его срок жизни задаются отдельно через `setSessionQueryPersistenceScope`,
 * поэтому query contract не хранит идентификатор пользователя или сессии.
 */
export function createSessionQueryPersistenceMeta(policy: SessionQueryPersistencePolicy) {
	const cacheName = policy.cacheName.trim();
	if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(cacheName)) {
		throw new Error("Имя session query cache должно содержать только строчные латинские буквы, цифры, _ и -");
	}
	if (!Number.isSafeInteger(policy.maxEntries) || policy.maxEntries < 1 || policy.maxEntries > 5_000) {
		throw new Error("Лимит session query cache должен быть целым числом от 1 до 5000");
	}
	if (policy.refetchOnRestore !== undefined && typeof policy.refetchOnRestore !== "boolean") {
		throw new Error("Политика refetch после восстановления должна быть boolean");
	}
	const monotonicRevisionField = policy.monotonicRevisionField?.trim();
	if (monotonicRevisionField !== undefined && !/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(monotonicRevisionField)) {
		throw new Error("Имя поля монотонной ревизии должно быть JavaScript-идентификатором длиной до 64 символов");
	}

	return {
		sessionScoped: true,
		sessionPersistence: {
			cacheName,
			maxEntries: policy.maxEntries,
			...(policy.refetchOnRestore === undefined ? {} : { refetchOnRestore: policy.refetchOnRestore }),
			...(monotonicRevisionField === undefined ? {} : { monotonicRevisionField })
		}
	} as const satisfies QueryMeta;
}
