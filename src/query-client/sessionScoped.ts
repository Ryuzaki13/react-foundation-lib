import { type Query, type QueryClient } from "@tanstack/react-query";

const SESSION_SCOPED_QUERY_CACHE_RESET_EVENT = "session-scoped-query-cache-reset";

type SessionScopedQueryCacheResetEvent = {
	readonly type: typeof SESSION_SCOPED_QUERY_CACHE_RESET_EVENT;
};

export type ResetSessionScopedQueriesOptions = {
	/**
	 * Передавать ли команду сброса другим вкладкам. При обработке входящего
	 * сообщения значение отключается, чтобы вкладки не создавали цикл событий.
	 */
	readonly broadcast?: boolean;
};

export type InstallSessionScopedQueryResetOptions = {
	/** Уникальное для приложения имя служебного BroadcastChannel. */
	readonly channelName: string;
};

export type InstalledSessionScopedQueryReset = {
	/** Освобождает канал и прекращает межвкладочную синхронизацию. */
	readonly cleanup: () => void;
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
	const filters = { predicate: isSessionScopedQuery } as const;

	await queryClient.cancelQueries(filters);

	const matchedQueries = queryClient.getQueryCache().findAll(filters);
	for (const query of matchedQueries) {
		if (query.getObserversCount() === 0) {
			queryClient.getQueryCache().remove(query);
			continue;
		}

		// Hydrated query хранит SSR-данные как initial state, поэтому одного
		// query.reset() недостаточно: старая сессия могла бы вернуться в UI.
		query.reset();
		query.setState({ data: undefined, dataUpdatedAt: 0 });
	}

	await queryClient.refetchQueries(
		{
			predicate: (query) => isSessionScopedQuery(query) && query.getObserversCount() > 0,
			type: "active"
		},
		{ cancelRefetch: true }
	);

	if (options.broadcast !== false) {
		broadcastSessionScopedQueryReset?.();
	}
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
		void resetSessionScopedQueries(queryClient, { broadcast: false });
	};

	return {
		cleanup: () => {
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
