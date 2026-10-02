/** Одноразовое пробуждение: предметную работу и обработку её отказа выполняет caller. */
export type DeadlineTimerOptions = Readonly<{
	onDue: () => void;
}>;

/** Абсолютный срок в Unix milliseconds не зависит от длительности предыдущей задачи. */
export type DeadlineTimer = Readonly<{
	/** Заменяет срок; null отменяет его. Некорректный срок не отменяет уже назначенный. */
	schedule: (deadlineAtMs: number | null) => void;
	/** Отзывает только ещё не начавшееся пробуждение, а не работу внутри onDue. */
	cancel: () => void;
}>;
