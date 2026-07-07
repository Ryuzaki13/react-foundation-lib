import { useEffect, useRef } from "react";

import { VirtualItem } from "@tanstack/react-virtual";

export function useFetchNextPageEffect({
	virtualItems,
	currentItemsCount,
	fetchNextPage,
	hasNextPage
}: {
	virtualItems: VirtualItem[];
	currentItemsCount: number;
	hasNextPage: boolean;
	fetchNextPage: () => Promise<unknown>;
}) {
	const fetchingRef = useRef(false);

	useEffect(() => {
		if (!virtualItems.length || !currentItemsCount) return;
		const lastVirtual = virtualItems[virtualItems.length - 1];

		if (lastVirtual.index >= currentItemsCount - 1 && hasNextPage && !fetchingRef.current) {
			fetchingRef.current = true;
			fetchNextPage?.().finally(() => {
				fetchingRef.current = false;
			});
		}
	}, [virtualItems, currentItemsCount, hasNextPage, fetchNextPage]);
}
