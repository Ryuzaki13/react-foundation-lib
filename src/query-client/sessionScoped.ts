import { type Query, type QueryClient } from "@tanstack/react-query";

import { beginSessionScopedQueryReset } from "./sessionScopedResetLifecycle";
import {
	type InstalledSessionScopedQueryReset,
	type InstallSessionScopedQueryResetOptions,
	type ResetSessionScopedQueriesOptions
} from "./sessionScopedTypes";

const SESSION_SCOPED_QUERY_CACHE_RESET_EVENT = "session-scoped-query-cache-reset";

type SessionScopedQueryCacheResetEvent = {
	readonly type: typeof SESSION_SCOPED_QUERY_CACHE_RESET_EVENT;
};

let broadcastSessionScopedQueryReset: (() => void) | undefined;

/** Проверяет, относится ли query к данным текущей серверной сессии. */
export function isSessionScopedQuery(query: Pick<Query, "meta">): boolean {
	return query.meta?.sessionScoped === true;
}

/**
 * Сбрасывает все session-scoped query после входа, выхода, обновления сессии
 * или потери авторизации.
 *
 * Сначала отменяются незавершённые запросы старой сессии, затем TanStack Query
 * очищает их состояние и повторно запрашивает только активные query. Обычные
 * публичные данные при этом остаются в кеше. По умолчанию отдельная команда
 * сброса отправляется другим вкладкам без передачи содержимого кеша или токенов.
 */
export async function resetSessionScopedQueries(queryClient: QueryClient, options: ResetSessionScopedQueriesOptions = {}): Promise<void> {
	const boundary = beginSessionScopedQueryReset(queryClient);
	const filters = { predicate: isSessionScopedQuery } as const;
	const failures: unknown[] = [];
	try {
		if (boundary.retirement) failures.push(...(await boundary.retirement));
		try {
			await queryClient.cancelQueries(filters);
		} catch (error) {
			failures.push(error);
		}

		// Отказ retirement не оставляет доступным прежний snapshot и не допускает
		// новые чтения. Ошибка одного observer также не прерывает очистку остальных.
		const matchedQueries = queryClient.getQueryCache().findAll(filters);
		for (const query of matchedQueries) {
			try {
				if (query.getObserversCount() === 0) {
					queryClient.getQueryCache().remove(query);
				} else {
					try {
						query.reset();
					} finally {
						// Hydration сохраняет SSR initialData: обычный reset мог бы вернуть старую сессию.
						query.setState({ data: undefined, dataUpdatedAt: 0 });
					}
				}
			} catch (error) {
				failures.push(error);
			}
		}

		if (failures.length === 0) {
			await queryClient.refetchQueries(
				{
					predicate: (query) => isSessionScopedQuery(query) && query.getObserversCount() > 0,
					type: "active"
				},
				{ cancelRefetch: true }
			);

			if (options.broadcast !== false) broadcastSessionScopedQueryReset?.();
		}
	} catch (error) {
		failures.push(error);
	} finally {
		failures.push(...(await boundary.complete({ status: failures.length === 0 ? "completed" : "failed" })));
	}
	if (failures.length === 1) throw failures[0];
	if (failures.length > 1) throw new AggregateError(failures, "Не удалось завершить сброс session-scoped Query");
}

/**
 * Подключает безопасную межвкладочную синхронизацию смены сессии.
 *
 * Канал передаёт только команду сброса. В отличие от полной синхронизации
 * Query cache, он не публикует данные query и потому подходит для auth-зависимых
 * ответов. На сервере и в браузерах без BroadcastChannel возвращается no-op.
 */
export function installSessionScopedQueryReset(
	queryClient: QueryClient,
	options: InstallSessionScopedQueryResetOptions
): InstalledSessionScopedQueryReset {
	if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
		return { cleanup: () => undefined };
	}

	const channel = new BroadcastChannel(options.channelName);
	const broadcast = () => {
		const event: SessionScopedQueryCacheResetEvent = {
			type: SESSION_SCOPED_QUERY_CACHE_RESET_EVENT
		};
		channel.postMessage(event);
	};

	broadcastSessionScopedQueryReset = broadcast;
	channel.onmessage = (event: MessageEvent<unknown>) => {
		if (!isSessionScopedQueryCacheResetEvent(event.data)) return;
		void resetSessionScopedQueries(queryClient, { broadcast: false }).catch(async (error: unknown) => {
			if (!options.onError) {
				console.error("Не удалось обработать межвкладочный сброс session-scoped Query", error);
				return;
			}
			try {
				await options.onError(error);
			} catch (reportingError) {
				console.error(
					"Не удалось сообщить об ошибке межвкладочного сброса session-scoped Query",
					new AggregateError([error, reportingError], "Ошибка сброса и её обработчика")
				);
			}
		});
	};

	let closed = false;
	return {
		cleanup: () => {
			if (closed) return;
			closed = true;
			channel.onmessage = null;
			channel.close();
			if (broadcastSessionScopedQueryReset === broadcast) {
				broadcastSessionScopedQueryReset = undefined;
			}
		}
	};
}

/** Защищает обработчик канала от посторонних или устаревших сообщений. */
function isSessionScopedQueryCacheResetEvent(value: unknown): value is SessionScopedQueryCacheResetEvent {
	return typeof value === "object" && value !== null && "type" in value && value.type === SESSION_SCOPED_QUERY_CACHE_RESET_EVENT;
}
