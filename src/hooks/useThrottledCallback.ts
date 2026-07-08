import { useCallback, useEffect, useRef } from "react";

export type ThrottledCallback<T> = {
	/**
	 * Основной вход: вызывай на каждом частом событии (например, onNodesChange).
	 * Колбэк `cb` будет вызываться не чаще, чем 1 раз в `intervalMs`.
	 *
	 * Стратегия: last-write-wins — если за интервал пришло много значений,
	 * по окончании интервала будет применено последнее.
	 */
	call: (arg: T) => void;

	/**
	 * Немедленно применить последнее накопленное значение (если оно есть),
	 * отменив запланированный вызов (если он был).
	 * Полезно на:
	 * - pointerup/mouseup (конец перетаскивания)
	 * - blur/visibilitychange/beforeunload
	 * - unmount (если хочешь гарантированно сохранить финальное состояние)
	 */
	flush: () => void;

	/**
	 * Отменить запланированный вызов и забыть накопленное значение.
	 * Полезно, если ты переключаешь редактор/граф и не хочешь “долетов” старых данных.
	 */
	cancel: () => void;
};

/**
 * useThrottledCallback (React 19 safe)
 *
 * Проблема:
 * - В xyflow onNodesChange/onEdgesChange может сыпаться очень часто.
 * - Если каждый раз писать “сериализуемый снапшот” в zustand → лишние ререндеры/CPU/GC.
 *
 * Решение:
 * - throttle: вызывать cb не чаще, чем 1 раз в intervalMs.
 * - last-write-wins: если за интервал пришло 50 обновлений — применим последнее.
 *
 * React 19 нюанс:
 * - нельзя мутировать ref.current во время render (линтер/правило).
 * - поэтому cbRef обновляем в useEffect.
 */
export function useThrottledCallback<T>(
	cb: (arg: T) => void,
	intervalMs: number,
	options?: { flushOnUnmount?: boolean }
): ThrottledCallback<T> {
	/**
	 * Актуальная версия cb (обновляется только после commit’а).
	 * Это решает "stale closure": call/flush/cancel стабильны,
	 * но всегда дергают самый свежий cb.
	 */
	const cbRef = useRef<(arg: T) => void>(cb);

	useEffect(() => {
		cbRef.current = cb;
	}, [cb]);

	/**
	 * Таймер отложенного выполнения.
	 * Он нужен, когда call() пришёл раньше, чем завершился текущий throttle-интервал:
	 * мы планируем “выполнить в конце окна”.
	 */
	const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/**
	 * Накопленное “последнее значение”.
	 * Всегда хранится последний arg, пришедший через call().
	 */
	const lastRef = useRef<T | null>(null);

	/**
	 * Время (timestamp) последнего РЕАЛЬНОГО вызова cb.
	 * Нужно, чтобы вычислять: можно ли выполнить сейчас или нужно подождать.
	 */
	const lastInvokeTsRef = useRef<number>(0);

	/**
	 * cancel():
	 * - отменяем отложенный таймер,
	 * - забываем накопленное значение.
	 * Важно: это не вызывает cb.
	 */
	const cancel = useCallback(() => {
		if (tRef.current) {
			clearTimeout(tRef.current);
			tRef.current = null;
		}
		lastRef.current = null;
	}, []);

	/**
	 * flush():
	 * - если есть накопленное значение, вызываем cb немедленно,
	 * - чистим таймер,
	 * - фиксируем lastInvokeTsRef (чтобы окно throttle считалось от flush тоже).
	 */
	const flush = useCallback(() => {
		const v = lastRef.current;
		if (v === null) return;

		// Сбрасываем накопленное ДО вызова cb на случай,
		// если cb внутри синхронно вызовет call() снова.
		lastRef.current = null;

		if (tRef.current) {
			clearTimeout(tRef.current);
			tRef.current = null;
		}

		lastInvokeTsRef.current = Date.now();
		cbRef.current(v);
	}, []);

	/**
	 * call(arg):
	 * 1) сохраняем arg как последнее значение (last-write-wins)
	 * 2) если с момента последнего вызова прошло достаточно времени → вызываем сразу
	 * 3) иначе — планируем flush ровно в момент, когда throttle-окно закончится
	 *
	 * При этом мы гарантируем:
	 * - не более одного cb вызова за intervalMs
	 * - и что “последнее значение за интервал” будет применено в конце.
	 */
	const call = useCallback(
		(arg: T) => {
			lastRef.current = arg;

			const now = Date.now();
			const elapsed = now - lastInvokeTsRef.current;

			// Если окно уже прошло — можно выполнить немедленно.
			if (elapsed >= intervalMs) {
				// Немедленный вызов = “leading edge”.
				// Берём последнее значение, очищаем lastRef и вызываем cb.
				const v = lastRef.current;
				lastRef.current = null;

				// На всякий случай прибираем таймер, если он был.
				if (tRef.current) {
					clearTimeout(tRef.current);
					tRef.current = null;
				}

				lastInvokeTsRef.current = now;
				if (v !== null) cbRef.current(v);
				return;
			}

			// Иначе — “trailing edge”: планируем выполнение в конце окна.
			// Важно: если таймер уже запланирован — НЕ пересоздаём,
			// потому что trailing-вызов должен случиться в конкретный момент (конец окна),
			// а значение мы и так обновляем через lastRef.current.
			if (!tRef.current) {
				const wait = intervalMs - elapsed;

				tRef.current = setTimeout(() => {
					tRef.current = null;
					// В конце окна применяем последнее накопленное значение
					flush();
				}, wait);
			}
		},
		[intervalMs, flush]
	);

	/**
	 * Cleanup на unmount:
	 * - по умолчанию cancel (не делаем побочных эффектов при размонтировании)
	 * - при flushOnUnmount=true — пытаемся сохранить последнее значение.
	 *
	 * Для твоего кейса (сериализация финального snapshot) чаще полезно flushOnUnmount=true.
	 */
	useEffect(() => {
		return () => {
			if (options?.flushOnUnmount) flush();
			else cancel();
		};
	}, [cancel, flush, options?.flushOnUnmount]);

	return { call, flush, cancel };
}
