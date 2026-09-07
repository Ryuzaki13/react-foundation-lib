import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installQueryInvalidationBroadcast } from "./invalidationBroadcast";

class FakeBroadcastChannel {
	private static readonly registry = new Map<string, FakeBroadcastChannel[]>();

	onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

	constructor(readonly name: string) {
		const peers = FakeBroadcastChannel.registry.get(name) ?? [];
		peers.push(this);
		FakeBroadcastChannel.registry.set(name, peers);
	}

	postMessage(data: unknown) {
		for (const peer of FakeBroadcastChannel.registry.get(this.name) ?? []) {
			if (peer !== this) peer.onmessage?.({ data } as MessageEvent<unknown>);
		}
	}

	close() {
		FakeBroadcastChannel.registry.set(
			this.name,
			(FakeBroadcastChannel.registry.get(this.name) ?? []).filter((peer) => peer !== this)
		);
	}

	static reset() {
		FakeBroadcastChannel.registry.clear();
	}
}

function installBrowserRuntime() {
	Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
	Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, value: FakeBroadcastChannel });
}

function removeBrowserRuntime() {
	Reflect.deleteProperty(globalThis, "window");
	Reflect.deleteProperty(globalThis, "BroadcastChannel");
}

function createClient() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	vi.spyOn(client, "invalidateQueries");
	return client;
}

const matchesTimetableWeek = (queryKey: QueryKey) => queryKey[0] === "timetable" && queryKey[1] === "week";

afterEach(() => {
	FakeBroadcastChannel.reset();
	removeBrowserRuntime();
});

describe("query-client/invalidation broadcast", () => {
	it("возвращает безопасный no-op вне browser runtime", () => {
		const installed = installQueryInvalidationBroadcast(createClient(), {
			channelName: "app:test:invalidation:ssr",
			matchesQuery: matchesTimetableWeek
		});

		expect(() => installed.broadcast(["timetable", "week"])).not.toThrow();
		expect(() => installed.cleanup()).not.toThrow();
	});

	it("передаёт только разрешённую точечную инвалидацию и refetch активной вкладки", async () => {
		installBrowserRuntime();
		const sender = createClient();
		const receiver = createClient();
		const first = installQueryInvalidationBroadcast(sender, {
			channelName: "app:test:invalidation:scoped",
			matchesQuery: matchesTimetableWeek
		});
		const second = installQueryInvalidationBroadcast(receiver, {
			channelName: "app:test:invalidation:scoped",
			matchesQuery: matchesTimetableWeek
		});
		sender.setQueryData(["auth", "me"], null);
		sender.setQueryData(["timetable", "week", "main", 2026], { revision: "before" });

		await sender.invalidateQueries({ queryKey: ["auth", "me"], exact: true });
		expect(receiver.invalidateQueries).not.toHaveBeenCalled();

		await sender.invalidateQueries({ queryKey: ["timetable", "week", "main", 2026], exact: true });
		expect(receiver.invalidateQueries).toHaveBeenCalledExactlyOnceWith({
			queryKey: ["timetable", "week", "main", 2026],
			exact: true,
			refetchType: "active"
		});
		expect(sender.invalidateQueries).toHaveBeenCalledTimes(2);

		first.cleanup();
		second.cleanup();
	});

	it("отклоняет невалидный или вышедший за scope payload без broadcast loop", () => {
		installBrowserRuntime();
		const client = createClient();
		const installed = installQueryInvalidationBroadcast(client, {
			channelName: "app:test:invalidation:invalid",
			matchesQuery: matchesTimetableWeek,
			refetchType: "none"
		});
		const foreign = new FakeBroadcastChannel("app:test:invalidation:invalid");

		foreign.postMessage({ type: "query.invalidate", senderId: "foreign", queryKey: "not-an-array" });
		foreign.postMessage({ type: "query.invalidate", senderId: "foreign", queryKey: ["auth", "me"] });
		expect(client.invalidateQueries).not.toHaveBeenCalled();

		foreign.postMessage({ type: "query.invalidate", senderId: "foreign", queryKey: ["timetable", "week"] });
		expect(client.invalidateQueries).toHaveBeenCalledExactlyOnceWith({
			queryKey: ["timetable", "week"],
			exact: true,
			refetchType: "none"
		});

		installed.cleanup();
	});
});
