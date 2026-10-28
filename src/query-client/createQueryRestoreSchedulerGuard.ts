import { isCancelledError, type Query } from "@tanstack/react-query";

import { type QueryRestoreSchedulerGuardOptions } from "./queryRestoreSchedulerTypes";

// Имена методов совпадают в typed façade и Proxy-перехвате.
const QUERY_SET_STATE_METHOD = "setState";
const QUERY_FETCH_METHOD = "fetch";

/**
 * Upstream schedules timestamp/refetch до завершения persisterFn. Отмена между
 * parser и публикацией не разрешает этой macrotask восстановить отменённую Query.
 * Façade существует только внутри одного обращения и не передаётся в QueryCache.
 */
export function createQueryRestoreSchedulerGuard({ query, assertCurrentRestore }: QueryRestoreSchedulerGuardOptions): Query {
	const isCurrent = () => {
		try {
			assertCurrentRestore();
			return true;
		} catch (error) {
			if (!isCancelledError(error)) throw error;
			return false;
		}
	};
	const setState: Query[typeof QUERY_SET_STATE_METHOD] = (...args) => {
		if (isCurrent()) query.setState(...args);
	};
	const fetch: Query[typeof QUERY_FETCH_METHOD] = (...args) => {
		// Фоновый callback upstream не ждёт fetch result; resolved no-op
		// предотвращает повторную работу и unhandled rejection после отмены.
		return isCurrent() ? query.fetch(...args) : Promise.resolve();
	};
	return new Proxy(query, {
		get: (target, property) => {
			if (property === QUERY_SET_STATE_METHOD) return setState;
			if (property === QUERY_FETCH_METHOD) return fetch;
			// Query использует private fields. Остальные методы выполняются с
			// исходным instance как this, а не с Proxy.
			const value: unknown = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		}
	});
}
