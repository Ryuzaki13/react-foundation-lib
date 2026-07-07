import type { UseQueryResult } from "@tanstack/react-query";

/**
 * Стандартный ответ `odataQueryFn` после трансформации данных.
 */
interface ODataQueryResultEnvelope<T> {
	data: T;
	totalCount?: number;
}

/**
 * Результат query-хука с уже распакованным полем `data`.
 */
export type UnwrappedODataQueryResult<T> = Omit<UseQueryResult<ODataQueryResultEnvelope<T>>, "data"> & {
	data: T | undefined;
	totalCount?: number;
};

/**
 * Приводит результат `useQuery` с `odataQueryFn` к привычному виду:
 * данные доступны сразу в `data`, а `totalCount` вынесен отдельно.
 */
export function unwrapODataQueryResult<T>(query: UseQueryResult<ODataQueryResultEnvelope<T>>): UnwrappedODataQueryResult<T> {
	const data = query.data?.data;
	const totalCount = query.data?.totalCount;

	return { ...query, data, totalCount };
}
