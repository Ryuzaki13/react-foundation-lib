import { uuidv4 } from "../crypto";
import { isRecord } from "../validators";

import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type QueryInvalidationBroadcastOptions = {
	/** Уникальное в пределах origin имя канала приложения. */
	readonly channelName: string;
	/** Ограничивает как исходящие, так и входящие Query keys. */
	readonly matchesQuery: (queryKey: QueryKey) => boolean;
	/** Определяет, какие queries получающей вкладки будут перезапрошены сразу. */
	readonly refetchType?: "none" | "active" | "inactive" | "all";
};

export type InstalledQueryInvalidationBroadcast = {
	/** Явно передаёт точечную инвалидацию без изменения локального QueryClient. */
	readonly broadcast: (queryKey: QueryKey) => void;
	readonly cleanup: () => void;
};

type QueryInvalidationWireMessage = {
	readonly type: "query.invalidate";
	readonly senderId: string;
	readonly queryKey: QueryKey;
};

function isQueryInvalidationWireMessage(value: unknown): value is QueryInvalidationWireMessage {
	return isRecord(value) && value.type === "query.invalidate" && typeof value.senderId === "string" && Array.isArray(value.queryKey);
}

/**
 * Передаёт между вкладками только факт инвалидации выбранного Query key.
 * Server data остаётся у QueryClient каждой вкладки и заново читается её queryFn.
 */
export function installQueryInvalidationBroadcast(
	queryClient: QueryClient,
	options: QueryInvalidationBroadcastOptions
): InstalledQueryInvalidationBroadcast {
	if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
		return { broadcast: () => undefined, cleanup: () => undefined };
	}

	const senderId = uuidv4();
	const channel = new BroadcastChannel(options.channelName);
	let applyingRemoteInvalidation = false;
	let closed = false;

	const broadcast = (queryKey: QueryKey) => {
		if (closed || !options.matchesQuery(queryKey)) return;
		channel.postMessage({ type: "query.invalidate", senderId, queryKey } satisfies QueryInvalidationWireMessage);
	};

	const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
		if (applyingRemoteInvalidation || event.type !== "updated" || event.action.type !== "invalidate") return;
		broadcast(event.query.queryKey);
	});

	channel.onmessage = (event: MessageEvent<unknown>) => {
		const message = event.data;
		if (closed || !isQueryInvalidationWireMessage(message) || message.senderId === senderId || !options.matchesQuery(message.queryKey))
			return;

		applyingRemoteInvalidation = true;
		try {
			void queryClient.invalidateQueries({
				queryKey: message.queryKey,
				exact: true,
				refetchType: options.refetchType ?? "active"
			});
		} finally {
			applyingRemoteInvalidation = false;
		}
	};

	return {
		broadcast,
		cleanup() {
			if (closed) return;
			closed = true;
			unsubscribe();
			channel.close();
		}
	};
}
