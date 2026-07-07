import {
	DefaultError,
	Mutation,
	MutationCache,
	MutationFunctionContext,
	Query,
	QueryCache,
	QueryClient,
	QueryKey
} from "@tanstack/react-query";

import { createReactQueryPersister } from "./persistence";

export type QueryBroadcastOptions = {
	onQueryError?: (error: DefaultError, query: Query<unknown, unknown, unknown>) => void;
	onMutationError?: (
		error: DefaultError,
		variables: unknown,
		onMutateResult: unknown,
		mutation: Mutation<unknown, unknown, unknown>,
		context: MutationFunctionContext
	) => Promise<unknown> | unknown;
};

/**
 * Создаёт singleton QueryClient (SPA).
 */
export function createQueryClient({ onQueryError, onMutationError }: QueryBroadcastOptions) {
	const queryPersister = createReactQueryPersister();

	const queryClient = new QueryClient({
		queryCache: new QueryCache({ onError: onQueryError }),
		mutationCache: new MutationCache({ onError: onMutationError }),
		defaultOptions: {
			queries: {
				staleTime: 10 * 60 * 1000,
				gcTime: 30 * 60 * 1000,
				throwOnError: false,
				retry: false,
				...(queryPersister ? { persister: queryPersister.persisterFn } : {})
			},
			mutations: {
				throwOnError: false,
				retry: false
			}
		}
	});

	return queryClient;
}

/**
 * Контекст, возвращаемый из `onMutateOptimistic`.
 * Содержит снапшот кеша до оптимистичного обновления.
 * Передаётся в `onError`, `onSuccess`, `onSettled` через TanStack Query.
 */
export type OptimisticContext<TQueryCacheData> = {
	previous: TQueryCacheData | undefined;
};

/**
 * ### не использвать, только планируется реализация
 *
 * _Оптимистичное обновление — это когда мы моментально меняем локальный кэш (и UI) до ответа сервера,
 * чтобы интерфейс был отзывчивым. Если сервер вернул ошибку — откатываем изменения.
 * Если сервер подтвердил — либо принимаем ответ сервера,
 * либо оставляем оптимистичное состояние (в зависимости от ситуации)._
 *
 * Обработчик `onMutate` для оптимистичного обновления.
 *
 * Выполняет три шага:
 * 1. Отменяет активные запросы по ключу — предотвращает гонку с сервером.
 * 2. Сохраняет снапшот текущего состояния кеша.
 * 3. Применяет оптимистичный патч через `patcher`.
 *
 * Возвращает {@link OptimisticContext} — передаётся в `onError` для отката.
 *
 * @example
 * // Обновление точечных данных в списке объектов
 * useMutation({
 *   mutationFn: (data: SomeType) => { ... },
 *   onMutate: async (data) =>
 *     onMutateOptimistic(queryClient, someQueryKey, (old) => {
 *       if (!old) return old;
 *       return old.map((item) =>
 *         item.id === data.id ? { ...item, visible: data.visible } : item
 *       );
 *     }),
 *   onError: (_err, _vars, context) =>
 *     onErrorOptimistic(queryClient, someQueryKey, context),
 *   onSettled: () =>
 *     onSettledOptimistic(queryClient, someQueryKey),
 * })
 */
export async function onMutateOptimistic<TQueryCacheData>(
	qc: QueryClient,
	queryKey: QueryKey,
	patcher: (oldCache: TQueryCacheData | undefined) => TQueryCacheData | undefined
): Promise<OptimisticContext<TQueryCacheData>> {
	// 1) Отменяем запросы по ключу, чтобы не было гонки с сервером
	await qc.cancelQueries({ queryKey });

	// 2) Сохраняем снапшот кеша для возможного отката
	const previous = qc.getQueryData<TQueryCacheData>(queryKey);

	// 3) Применяем оптимистичный патч
	qc.setQueryData<TQueryCacheData>(queryKey, patcher);

	return { previous };
}

/**
 * Обработчик `onError` для оптимистичного обновления.
 *
 * Откатывает кеш к снапшоту, сохранённому в {@link OptimisticContext}.
 * Если `context` не определён (например, `onMutate` сам выбросил ошибку) — безопасно ничего не делает.
 *
 * @example
 * onError: (_err, _vars, context) =>
 *   onErrorOptimistic(queryClient, someQueryKey, context),
 */
export function onErrorOptimistic<TQueryCacheData>(
	qc: QueryClient,
	queryKey: QueryKey,
	context: OptimisticContext<TQueryCacheData> | undefined
): void {
	if (context?.previous !== undefined) {
		qc.setQueryData<TQueryCacheData>(queryKey, context.previous);
	}
}

/**
 * Обработчик `onSuccess` для оптимистичного обновления — применяет данные сервера в кеш.
 *
 * Используется, когда сервер вернул авторитетные данные, которые нужно слить
 * с текущим состоянием кеша (или заменить его целиком).
 *
 * Если сервер вернул `void` — эту функцию вызывать не нужно:
 * оптимистичное состояние в кеше остаётся без изменений.
 *
 * @param qc - экземпляр `QueryClient`
 * @param queryKey - ключ кеша
 * @param serverData - данные, вернувшиеся от сервера
 * @param merger - функция слияния: получает текущий кеш и ответ сервера, возвращает новое состояние
 *
 * @example
 * // Полная замена кеша ответом сервера
 * onSuccess: (data) =>
 *   onSuccessOptimistic(queryClient, someQueryKey, data, (_cache, serverData) => serverData),
 *
 * @example
 * // Точечное обновление одного элемента в списке
 * onSuccess: (updatedItem) =>
 *   onSuccessOptimistic(queryClient, someQueryKey, updatedItem,
 *     (cache, item) => cache?.map((i) => (i.id === item.id ? item : i))
 *   ),
 */
export function onSuccessOptimistic<TQueryCacheData, TServerData>(
	qc: QueryClient,
	queryKey: QueryKey,
	serverData: TServerData,
	merger: (cache: TQueryCacheData | undefined, serverData: TServerData) => TQueryCacheData | undefined
): void {
	qc.setQueryData<TQueryCacheData>(queryKey, (old) => merger(old, serverData));
}

/**
 * Параметры для {@link onSettledOptimistic}.
 */
export type OnSettledOptimisticOptions = {
	/**
	 * Тип рефетча при инвалидации.
	 * - `"none"` (по умолчанию) — помечает кеш устаревшим, но не запускает рефетч немедленно.
	 * - `"active"` — немедленно перезапрашивает активные подписчики.
	 * - `"inactive"` — перезапрашивает неактивные (фоновые) запросы.
	 * - `"all"` — перезапрашивает все подходящие запросы.
	 */
	refetchType?: "none" | "active" | "inactive" | "all";
};

/**
 * Обработчик `onSettled` для оптимистичного обновления.
 *
 * Инвалидирует один или несколько query-ключей после завершения мутации
 * (выполняется и при успехе, и при ошибке).
 *
 * По умолчанию использует `refetchType: "none"` — помечает кеш устаревшим,
 * но не запускает немедленный рефетч. Это безопасный вариант при оптимистике:
 * данные в кеше уже актуальны (подтверждены или откатаны), а рефетч произойдёт
 * при следующем монтировании или явном запросе.
 *
 * Broadcast в другие вкладки — ответственность вызывающего кода через `broadcastCacheEvent`.
 *
 * @example
 * onSettled: () =>
 *   onSettledOptimistic(queryClient, someQueryKey),
 *
 * @example
 * // С принудительным рефетчем активных подписчиков
 * onSettled: () =>
 *   onSettledOptimistic(queryClient, [queryKeyA, queryKeyB], { refetchType: "active" }),
 */
export async function onSettledOptimistic(
	qc: QueryClient,
	queryKeys: QueryKey | QueryKey[],
	options?: OnSettledOptimisticOptions
): Promise<void> {
	const refetchType = options?.refetchType ?? "none";
	// Нормализуем одиночный ключ к массиву для единообразной обработки
	const keys: QueryKey[] = isNestedQueryKey(queryKeys) ? queryKeys : [queryKeys];

	await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey, refetchType })));
}

/**
 * Определяет, является ли значение массивом query-ключей (QueryKey[]),
 * а не одиночным QueryKey.
 *
 * QueryKey в TanStack Query — это `string | readonly unknown[]`.
 * Чтобы отличить `QueryKey[]` от `QueryKey` типа `readonly unknown[]`,
 * проверяем, содержит ли массив хотя бы один вложенный массив или строку на верхнем уровне.
 */
function isNestedQueryKey(value: QueryKey | QueryKey[]): value is QueryKey[] {
	if (!Array.isArray(value)) return false;
	// Если первый элемент сам является массивом — это QueryKey[]
	return Array.isArray(value[0]);
}
