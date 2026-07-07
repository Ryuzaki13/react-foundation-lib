import { useCallback, useEffect, useRef } from "react";

/**
 * Дебаунсит вызов колбэка: частые вызовы `call(value)` не вызывают `cb` сразу,
 * а откладывают его на `delayMs` после последнего вызова.
 *
 * Важно:
 * - Всегда сохраняется *последнее* значение (last-write-wins).
 * - `flush()` немедленно вызывает cb с последним сохранённым значением (если оно есть).
 * - `cancel()` отменяет таймер и забывает последнее значение.
 * - На unmount автоматически вызывается `cancel()` чтобы не было setState после размонтирования.
 *
 * Типовой кейс:
 * - onNodesChange -> call(snapshot)
 * - pointerup / blur / unmount -> flush() (или cancel(), если не надо сохранять)
 */
export function useDebouncedCallback<T>(cb: (arg: T) => void, delayMs: number, options?: { flushOnUnmount?: boolean }) {
	/**
	 * Храним актуальную версию cb в ref, чтобы:
	 * - не пересоздавать дебаунсер при каждом рендере,
	 * - не ловить устаревший замыканием cb (stale closure),
	 * - при этом всегда вызывать самую свежую функцию.
	 */
	const cbRef = useRef<(arg: T) => void>(cb);

	/**
	 * Обновляем актуальную версию cb после commit'а
	 */
	useEffect(() => {
		cbRef.current = cb;
	}, [cb]);

	/**
	 * id таймера. null означает что таймер не активен.
	 */
	const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	/**
	 * Последнее значение, которое мы хотим "закоммитить" в cb.
	 * Используем стратегию last-write-wins.
	 */
	const lastRef = useRef<T | null>(null);

	/**
	 * cancel():
	 * - останавливаем таймер, если он был,
	 * - очищаем последнее значение (ничего не будет вызвано).
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
	 * - если есть отложенное значение, вызываем cb немедленно,
	 * - сбрасываем таймер и lastRef.
	 *
	 * Используется, когда нужно гарантированно сохранить "последнее" прямо сейчас:
	 * - unmount
	 * - visibilitychange/blur
	 * - pointerup/mouseup (конец взаимодействия)
	 */
	const flush = useCallback(() => {
		const v = lastRef.current;
		if (v === null) return;

		// Сбрасываем before-call, чтобы если cb вызовет call() рекурсивно,
		// мы не держали старое значение.
		lastRef.current = null;

		if (tRef.current) {
			clearTimeout(tRef.current);
			tRef.current = null;
		}

		cbRef.current(v);
	}, []);

	/**
	 * call(arg):
	 * - сохраняем arg как "последнее значение"
	 * - перезапускаем таймер
	 * - по истечении delayMs вызываем flush()
	 */
	const call = useCallback(
		(arg: T) => {
			lastRef.current = arg;

			// Перезапуск таймера -> классический debounce
			if (tRef.current) clearTimeout(tRef.current);

			tRef.current = setTimeout(() => {
				tRef.current = null;
				flush();
			}, delayMs);
		},
		[delayMs, flush]
	);

	/**
	 * Авто-cancel на unmount:
	 *  - убирает pending timeout
	 *  - предотвращает вызовы cb после размонтирования компонента
	 */
	useEffect(() => {
		return () => {
			if (options?.flushOnUnmount) {
				flush();
			} else {
				cancel();
			}
		};
	}, [cancel, flush, options?.flushOnUnmount]);

	return { call, flush, cancel };
}
