export type ResetSessionScopedQueriesOptions = Readonly<{
	/** Отключается при обработке входящего сообщения, чтобы вкладки не создавали цикл reset. */
	broadcast?: boolean;
}>;

export type InstallSessionScopedQueryResetOptions = Readonly<{
	/** Уникальное для приложения имя служебного BroadcastChannel. */
	channelName: string;
	/** Ошибка входящего reset; без callback выводится в console.error, не становится unhandled rejection. */
	onError?: (error: unknown) => void | Promise<void>;
}>;

export type InstalledSessionScopedQueryReset = Readonly<{
	/** Освобождает канал и прекращает межвкладочную синхронизацию. */
	cleanup: () => void;
}>;
