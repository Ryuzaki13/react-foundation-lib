import { useMemo } from "react";

import { AnyRouter, useNavigate, useSearch } from "@tanstack/react-router";

import { SearchParams, SearchParamsUpdater } from "./types";

export function useSearchParams<K extends PropertyKey>(allowedKeys?: (keyof K)[]) {
	const params = useSearch<AnyRouter, string, false, true, SearchParams<K>>({ strict: false });
	const navigate = useNavigate();

	// Фильтруем параметры, оставляя только разрешенные ключи
	const filteredParams = useMemo(() => {
		if (!allowedKeys) return params;

		return Object.fromEntries(Object.entries(params).filter(([key]) => allowedKeys.includes(key as keyof K))) as SearchParams<K>;
	}, [params, allowedKeys]);

	const setParams = (next: SearchParamsUpdater<K>) =>
		navigate({
			to: ".",
			search: (prev: SearchParams<K>) => ({
				...prev,
				...next
			}),
			replace: true
		});

	return { params, setParams, filteredParams };
}
