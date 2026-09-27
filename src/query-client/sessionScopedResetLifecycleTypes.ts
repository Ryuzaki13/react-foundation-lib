/** Результат retirement и самого reset; ошибки остаются в отклонённом Promise вызывающего кода. */
export type SessionScopedQueryResetOutcome = Readonly<{ status: "completed" | "failed" }>;

/** Техническая граница внешних session-bound ресурсов, без знания auth или содержимого Query. */
export type SessionScopedQueryResetLifecycle = Readonly<{
	/** Синхронно отзывает допуск; Promise завершает освобождение ресурсов до отмены и очистки Query. */
	beforeReset: () => void | Promise<void>;
	/** Парный finally: вызывается и после cleanup регистрации; failed не разрешает восстановить прежний scope. */
	afterReset: (outcome: SessionScopedQueryResetOutcome) => void;
}>;

export type InstalledSessionScopedQueryResetLifecycle = Readonly<{
	/** Идемпотентно запрещает будущие before, не отменяя уже захваченную пару текущего reset. */
	cleanup: () => void;
}>;
