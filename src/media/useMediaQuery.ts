import { useCallback, useSyncExternalStore } from "react";

type UseMediaQueryOptions = {
	readonly ssrFallback?: boolean;
};

const noop = () => {};

function readMediaQuery(query: string, fallback: boolean): boolean {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return fallback;

	return window.matchMedia(query).matches;
}

function subscribeMediaQuery(query: string, listener: () => void): () => void {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return noop;

	const mql = window.matchMedia(query);

	if (typeof mql.addEventListener === "function") {
		mql.addEventListener("change", listener);
		return () => mql.removeEventListener("change", listener);
	}

	mql.addListener(listener);
	return () => mql.removeListener(listener);
}

/**
 * SSR-безопасная подписка на произвольный media query.
 * Используется для клиентских предпочтений, где значение должно совпадать с SSR fallback на гидрации.
 */
export function useMediaQuery(query: string, { ssrFallback = false }: UseMediaQueryOptions = {}) {
	const subscribe = useCallback((listener: () => void) => subscribeMediaQuery(query, listener), [query]);
	const getSnapshot = useCallback(() => readMediaQuery(query, ssrFallback), [query, ssrFallback]);
	const getServerSnapshot = useCallback(() => ssrFallback, [ssrFallback]);

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
