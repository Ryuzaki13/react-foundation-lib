import { useLocation } from "@tanstack/react-router";

import { SearchParams } from "./types";

export function useSearchLink<K extends PropertyKey>() {
	const location = useLocation();

	const buildLink = (params: SearchParams<K>) => {
		const next = new URLSearchParams(location.searchStr);

		params = params || [];

		for (const param in params) {
			const value = params[param];

			if (value) {
				next.set(param, String(value));
			} else {
				next.delete(param);
			}
		}

		const searchString = next.toString();
		return `${location.pathname}${searchString ? `?${searchString}` : ""}${location.hash}`;
	};

	return { buildLink };
}
