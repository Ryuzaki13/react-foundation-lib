/** Настройки одной последовательной задачи, без знания transport, БД или предметного состава. */
export type CoalescingTaskRunnerOptions = Readonly<{
	run: () => Promise<void>;
	/** Обработчик ожидается; его собственный отказ закрывает поколение до явного stop. */
	onError: (error: unknown) => void | Promise<void>;
	/** Явная задержка повтора, без навязанной библиотекой политики backoff. */
	retryDelayMs: number;
	/** Необязательное пробуждение; отсутствие не заменяется периодом по умолчанию. */
	pollIntervalMs?: number;
}>;

/** Promise start/wake относится текущей попытке, а не объединённому будущему хвосту. */
export type CoalescingTaskRunner = Readonly<{
	start: () => Promise<void>;
	wake: () => Promise<void>;
	/** Отзывает дальнейший допуск и ждёт фактического завершения задачи и onError. */
	stop: () => Promise<void>;
}>;
