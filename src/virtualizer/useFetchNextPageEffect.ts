import { useEffect, useRef } from "react";

import { type UseFetchNextPageEffectOptions } from "./useFetchNextPageEffectTypes";

/**
 * Достигнутый край запускает одну дозагрузку. Отказ не превращается в detached
 * rejection и не повторяется из-за новых virtual items при каждом scroll/render.
 */
export function useFetchNextPageEffect({
	virtualItems,
	currentItemsCount,
	fetchNextPage,
	hasNextPage,
	onError
}: UseFetchNextPageEffectOptions): void {
	const fetchingRef = useRef(false);
	const failedItemsCountRef = useRef<number | null>(null);
	const mountedRef = useRef(false);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			// Transport принадлежит caller и не отменяется; поздний отказ остаётся
			// диагностикой, но уже не вызывает callback размонтированного UI.
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		// Новые данные либо явное выключение pagination разрешают следующую
		// попытку. Identity callback и видимого диапазона не являются retry.
		if (!hasNextPage || failedItemsCountRef.current !== currentItemsCount) failedItemsCountRef.current = null;
		if (
			!virtualItems.length ||
			!currentItemsCount ||
			!hasNextPage ||
			fetchingRef.current ||
			failedItemsCountRef.current === currentItemsCount
		)
			return;
		const lastVirtual = virtualItems[virtualItems.length - 1];

		if (lastVirtual.index >= currentItemsCount - 1) {
			fetchingRef.current = true;
			// Начало через Promise охватывает и синхронный throw transport callback.
			// Обе ветки завершения обработаны: finally не создаёт второй rejected Promise.
			void Promise.resolve()
				.then(fetchNextPage)
				.then(
					() => {
						fetchingRef.current = false;
					},
					async (error: unknown) => {
						failedItemsCountRef.current = currentItemsCount;
						try {
							if (mountedRef.current && onError) await onError(error);
							else console.error("Не удалось загрузить следующую страницу виртуализированного списка.", error);
						} catch (reporterError: unknown) {
							console.error("Не удалось обработать ошибку дозагрузки виртуализированного списка.", error, reporterError);
						} finally {
							fetchingRef.current = false;
						}
					}
				);
		}
	}, [virtualItems, currentItemsCount, hasNextPage, fetchNextPage, onError]);
}
