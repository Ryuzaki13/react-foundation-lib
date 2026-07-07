import { afterEach, describe, expect, it, vi } from "vitest";

import { broadcastCacheEvent, installReactQueryBroadcast, setBroadcastFn } from "./broadcast";

import { QueryClient } from "@tanstack/react-query";

const { broadcastQueryClientMock } = vi.hoisted(() => ({
	broadcastQueryClientMock: vi.fn()
}));

vi.mock("@tanstack/query-broadcast-client-experimental", () => ({
	broadcastQueryClient: broadcastQueryClientMock
}));

class FakeBroadcastChannel {
	private static registry = new Map<string, FakeBroadcastChannel[]>();

	name: string;
	onmessage: ((event: MessageEvent) => void) | null = null;

	constructor(name: string) {
		this.name = name;

		const peers = FakeBroadcastChannel.registry.get(name) ?? [];
		peers.push(this);
		FakeBroadcastChannel.registry.set(name, peers);
	}

	postMessage(data: unknown) {
		const peers = FakeBroadcastChannel.registry.get(this.name) ?? [];
		for (const peer of peers) {
			if (peer === this) continue;
			peer.onmessage?.({ data } as MessageEvent);
		}
	}

	close() {
		const peers = FakeBroadcastChannel.registry.get(this.name) ?? [];
		FakeBroadcastChannel.registry.set(
			this.name,
			peers.filter((peer) => peer !== this)
		);
	}

	static reset() {
		FakeBroadcastChannel.registry.clear();
	}
}

function createQueryClientMock(): QueryClient {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false
			}
		}
	});

	vi.spyOn(queryClient, "invalidateQueries");
	vi.spyOn(queryClient, "setQueryData");

	return queryClient;
}

function installWindowRuntime() {
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {}
	});

	Object.defineProperty(globalThis, "BroadcastChannel", {
		configurable: true,
		value: FakeBroadcastChannel
	});
}

function removeWindowRuntime() {
	Reflect.deleteProperty(globalThis, "window");
	Reflect.deleteProperty(globalThis, "BroadcastChannel");
}

afterEach(() => {
	FakeBroadcastChannel.reset();
	broadcastQueryClientMock.mockReset();
	setBroadcastFn(() => {});
	removeWindowRuntime();
});

describe("query-client/broadcast", () => {
	it("возвращает no-op broadcast вне браузерного окружения", () => {
		const queryClient = createQueryClientMock();

		const { broadcast } = installReactQueryBroadcast(queryClient, {
			queriesChannel: "arm:test:queries",
			eventsChannel: "arm:test:events"
		});

		expect(broadcastQueryClientMock).not.toHaveBeenCalled();
		expect(() => broadcast({ type: "invalidate", keys: [["tiles"]] })).not.toThrow();
	});

	it("инициализирует синхронизацию query cache через broadcastQueryClient", () => {
		installWindowRuntime();
		const queryClient = createQueryClientMock();

		installReactQueryBroadcast(queryClient, {
			queriesChannel: "arm:test:queries",
			eventsChannel: "arm:test:events"
		});

		expect(broadcastQueryClientMock).toHaveBeenCalledTimes(1);
		expect(broadcastQueryClientMock).toHaveBeenCalledWith({
			queryClient,
			broadcastChannel: "arm:test:queries"
		});
	});

	it("передаёт invalidate между вкладками, включая refetchType = inactive", () => {
		installWindowRuntime();

		const senderClient = createQueryClientMock();
		const receiverClient = createQueryClientMock();

		const { broadcast } = installReactQueryBroadcast(senderClient, {
			queriesChannel: "arm:test:queries",
			eventsChannel: "arm:test:events"
		});

		installReactQueryBroadcast(receiverClient, {
			queriesChannel: "arm:test:queries",
			eventsChannel: "arm:test:events"
		});

		broadcast({
			type: "invalidate",
			keys: [["tiles"], ["views", "metalbase"]],
			refetchType: "inactive"
		});

		expect(receiverClient.invalidateQueries).toHaveBeenCalledTimes(2);
		expect(receiverClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
			queryKey: ["tiles"],
			refetchType: "inactive"
		});
		expect(receiverClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
			queryKey: ["views", "metalbase"],
			refetchType: "inactive"
		});
		expect(senderClient.invalidateQueries).not.toHaveBeenCalled();
	});

	it("автоматически передаёт invalidation любого query cache между вкладками", async () => {
		installWindowRuntime();

		const senderClient = createQueryClientMock();
		const receiverClient = createQueryClientMock();
		const queryKey = ["odata", "metadata", { service: "ZDEMO_SRV" }] as const;

		senderClient.setQueryData(queryKey, { source: "sender" });
		receiverClient.setQueryData(queryKey, { source: "receiver" });

		installReactQueryBroadcast(senderClient, {
			queriesChannel: "arm:test:queries:auto-invalidate",
			eventsChannel: "arm:test:events:auto-invalidate"
		});

		installReactQueryBroadcast(receiverClient, {
			queriesChannel: "arm:test:queries:auto-invalidate",
			eventsChannel: "arm:test:events:auto-invalidate"
		});

		await senderClient.invalidateQueries({ queryKey });

		expect(receiverClient.invalidateQueries).toHaveBeenCalledTimes(1);
		expect(receiverClient.invalidateQueries).toHaveBeenCalledWith({
			queryKey,
			refetchType: "none"
		});
		expect(receiverClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
		expect(senderClient.invalidateQueries).toHaveBeenCalledTimes(1);
	});

	it("передаёт setQueryData между вкладками", () => {
		installWindowRuntime();

		const senderClient = createQueryClientMock();
		const receiverClient = createQueryClientMock();

		const { broadcast } = installReactQueryBroadcast(senderClient, {
			queriesChannel: "arm:test:queries:set",
			eventsChannel: "arm:test:events:set"
		});

		installReactQueryBroadcast(receiverClient, {
			queriesChannel: "arm:test:queries:set",
			eventsChannel: "arm:test:events:set"
		});

		broadcast({
			type: "setQueryData",
			key: ["tiles"],
			data: [{ id: "1", title: "Главная" }]
		});

		expect(receiverClient.setQueryData).toHaveBeenCalledTimes(1);
		expect(receiverClient.setQueryData).toHaveBeenCalledWith(["tiles"], [{ id: "1", title: "Главная" }]);
		expect(senderClient.setQueryData).not.toHaveBeenCalled();
	});

	it("игнорирует невалидные сообщения из канала", () => {
		installWindowRuntime();

		const queryClient = createQueryClientMock();

		installReactQueryBroadcast(queryClient, {
			queriesChannel: "arm:test:queries:invalid",
			eventsChannel: "arm:test:events:invalid"
		});

		const foreignChannel = new FakeBroadcastChannel("arm:test:events:invalid");
		foreignChannel.postMessage({
			tabId: "foreign-tab",
			event: { type: "invalidate", keys: [["tiles"]], refetchType: "unexpected" }
		});

		expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
		expect(queryClient.setQueryData).not.toHaveBeenCalled();
	});

	it("broadcastCacheEvent вызывает установленный broadcast-обработчик", () => {
		const handler = vi.fn();
		setBroadcastFn(handler);

		broadcastCacheEvent({
			type: "invalidate",
			keys: [["tiles"]],
			refetchType: "none"
		});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({
			type: "invalidate",
			keys: [["tiles"]],
			refetchType: "none"
		});
	});
});
