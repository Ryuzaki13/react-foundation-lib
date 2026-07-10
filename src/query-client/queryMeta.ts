import { type QueryMeta } from "@tanstack/react-query";

/**
 * Общие признаки query, которые управляют инфраструктурой клиентского кеша.
 *
 * `persist` разрешает долговременное хранение публичных справочных данных,
 * а `sessionScoped` помечает данные, доступность или содержимое которых зависит
 * от текущей серверной сессии. Эти признаки нельзя совмещать: session-scoped
 * query никогда не должна переживать смену пользователя или роли.
 */
export type AppQueryMeta = {
	readonly persist?: boolean;
	readonly sessionScoped?: boolean;
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
