import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { installReactQueryBroadcast } from "./broadcast";

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

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false
			}
		}
	});
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

async function waitForExpectation(assertion: () => void) {
	const startedAt = Date.now();
	let lastError: unknown;

	while (Date.now() - startedAt < 1000) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	if (lastError instanceof Error) {
		throw lastError;
	}

	throw new Error("Ожидание условия broadcast завершилось без результата.");
}

afterEach(() => {
	FakeBroadcastChannel.reset();
	removeWindowRuntime();
});

describe("query-client/broadcast integration", () => {
	it("синхронизирует успешное обновление query data через реальный broadcastQueryClient", async () => {
		installWindowRuntime();

		const senderClient = createQueryClient();
		const receiverClient = createQueryClient();
		const channelId = `arm:test:integration:${Date.now()}`;
		const senderBroadcast = installReactQueryBroadcast(senderClient, {
			queriesChannel: `${channelId}:queries`,
			eventsChannel: `${channelId}:events`
		});
		const receiverBroadcast = installReactQueryBroadcast(receiverClient, {
			queriesChannel: `${channelId}:queries`,
			eventsChannel: `${channelId}:events`
		});

		try {
			senderClient.setQueryData(["broadcast", "data"], { value: 1 });

			await waitForExpectation(() => {
				expect(receiverClient.getQueryData(["broadcast", "data"])).toEqual({ value: 1 });
			});
		} finally {
			senderBroadcast.cleanup();
			receiverBroadcast.cleanup();
			senderClient.clear();
			receiverClient.clear();
		}
	});
});
