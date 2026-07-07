import { broadcastQueryClient } from "@tanstack/query-broadcast-client-experimental";

import { uuidv4 } from "../crypto";
import { isRecord } from "../validators";

import type { QueryClient, QueryKey } from "@tanstack/react-query";

type CacheSyncEvent =
	| { type: "invalidate"; keys: QueryKey[]; refetchType?: "none" | "all" | "active" | "inactive" }
	| { type: "setQueryData"; key: QueryKey; data: unknown };

type InstallBroadcastOptions = {
	queriesChannel: string;
	eventsChannel: string;
};

type InstalledReactQueryBroadcast = {
	broadcast: (event: CacheSyncEvent) => void;
	cleanup: () => void;
};

type WireMessage = {
	tabId: string;
	event: CacheSyncEvent;
};

let broadcastFn: ((event: CacheSyncEvent) => void) | null = null;

export function setBroadcastFn(fn: (event: CacheSyncEvent) => void) {
	broadcastFn = fn;
}

export function broadcastCacheEvent(event: CacheSyncEvent) {
	broadcastFn?.(event);
}

export function installReactQueryBroadcast(queryClient: QueryClient, opts: InstallBroadcastOptions): InstalledReactQueryBroadcast {
	if (typeof window === "undefined") {
		return { broadcast: () => {}, cleanup: () => {} };
	}

	let isApplyingRemoteEvent = false;

	// 1) Sync query cache (data/state)
	const cleanupQueryBroadcast = broadcastQueryClient({
		queryClient,
		broadcastChannel: opts.queriesChannel
	});

	// 2) Sync "events" (invalidate/setQueryData)
	const tabId = uuidv4();
	const bc = new BroadcastChannel(opts.eventsChannel);
	const unsubscribeInvalidationBroadcast = queryClient.getQueryCache().subscribe((queryEvent) => {
		if (isApplyingRemoteEvent) return;
		if (queryEvent.type !== "updated" || queryEvent.action.type !== "invalidate") return;

		broadcast({
			type: "invalidate",
			keys: [queryEvent.query.queryKey],
			refetchType: "none"
		});
	});

	bc.onmessage = (ev: MessageEvent) => {
		// MessageEvent.data: unknown -> делаем безопасное сужение без any
		const data: unknown = ev.data;
		if (!isWireMessage(data)) return;
		if (data.tabId === tabId) return;

		const e = data.event;
		isApplyingRemoteEvent = true;

		try {
			if (e.type === "invalidate") {
				const refetchType = e.refetchType ?? "none";
				for (const key of e.keys) {
					queryClient.invalidateQueries({ queryKey: key, refetchType });
				}
				return;
			}

			if (e.type === "setQueryData") {
				queryClient.setQueryData(e.key, e.data);
				return;
			}
		} finally {
			isApplyingRemoteEvent = false;
		}
	};

	function broadcast(event: CacheSyncEvent) {
		const msg: WireMessage = { tabId, event };
		bc.postMessage(msg);
	}

	return {
		broadcast,
		cleanup: () => {
			unsubscribeInvalidationBroadcast();
			cleanupQueryBroadcast();
			bc.close();
		}
	};
}

function isWireMessage(v: unknown): v is WireMessage {
	if (!isRecord(v)) return false;
	if (typeof v.tabId !== "string") return false;
	if (!("event" in v)) return false;
	return isCacheSyncEvent(v.event);
}

function isCacheSyncEvent(v: unknown): v is CacheSyncEvent {
	if (!isRecord(v)) return false;
	if (v.type === "invalidate") {
		// keys: QueryKey[] — runtime мы не сможем валидировать “идеально”,
		// но проверим что это массив, а refetchType — допустимое значение
		if (!Array.isArray(v.keys)) return false;
		if (v.refetchType === undefined) return true;
		return v.refetchType === "none" || v.refetchType === "active" || v.refetchType === "inactive" || v.refetchType === "all";
	}
	if (v.type === "setQueryData") {
		// key должен быть массивом или строкой — QueryKey в рантайме обычно массив
		// проверим хотя бы наличие поля
		return "key" in v && "data" in v;
	}
	return false;
}
