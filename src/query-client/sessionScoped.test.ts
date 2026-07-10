import { dehydrate, hydrate, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionScopedQueryMeta } from "./queryMeta";
import { installSessionScopedQueryReset, resetSessionScopedQueries } from "./sessionScoped";

class FakeBroadcastChannel {
	private static registry = new Map<string, FakeBroadcastChannel[]>();

	readonly name: string;
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
			queries: { retry: false }
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

afterEach(() => {
	FakeBroadcastChannel.reset();
	removeWindowRuntime();
});

describe("query-client/sessionScoped", () => {
	it("сбрасывает только неактивные session-scoped query", async () => {
		const queryClient = createQueryClient();
		const publicKey = ["public"] as const;
		const sessionKey = ["session"] as const;

		await queryClient.fetchQuery({
			queryKey: publicKey,
			queryFn: () => "публичные данные"
		});
		await queryClient.fetchQuery({
			queryKey: sessionKey,
			queryFn: () => "данные сессии",
			meta: sessionScopedQueryMeta
		});

		await resetSessionScopedQueries(queryClient);

		expect(queryClient.getQueryData(publicKey)).toBe("публичные данные");
		expect(queryClient.getQueryData(sessionKey)).toBeUndefined();
	});

	it("удаляет восстановленные SSR-данные прежней сессии", async () => {
		const serverQueryClient = createQueryClient();
		const queryKey = ["hydrated-session"] as const;
		await serverQueryClient.fetchQuery({
			queryKey,
			queryFn: () => "серверная сессия",
			meta: sessionScopedQueryMeta
		});

		const browserQueryClient = createQueryClient();
		hydrate(browserQueryClient, dehydrate(serverQueryClient));
		expect(browserQueryClient.getQueryData(queryKey)).toBe("серверная сессия");

		await resetSessionScopedQueries(browserQueryClient);

		expect(browserQueryClient.getQueryData(queryKey)).toBeUndefined();
		expect(browserQueryClient.getQueryCache().find({ queryKey })).toBeUndefined();
	});

	it("после сброса повторно запрашивает активную session-scoped query", async () => {
		const queryClient = createQueryClient();
		const queryKey = ["active-session"] as const;
		const queryFn = vi.fn().mockResolvedValueOnce("старая сессия").mockResolvedValueOnce("новая сессия");

		await queryClient.fetchQuery({
			queryKey,
			queryFn,
			meta: sessionScopedQueryMeta,
			staleTime: Infinity
		});

		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn,
			meta: sessionScopedQueryMeta,
			staleTime: Infinity
		});
		const unsubscribe = observer.subscribe(() => undefined);

		await resetSessionScopedQueries(queryClient);

		expect(queryFn).toHaveBeenCalledTimes(2);
		expect(queryClient.getQueryData(queryKey)).toBe("новая сессия");
		unsubscribe();
	});

	it("очищает наблюдаемую disabled query без принудительного refetch", async () => {
		const queryClient = createQueryClient();
		const queryKey = ["disabled-session"] as const;
		const queryFn = vi.fn().mockResolvedValue("данные сессии");

		await queryClient.fetchQuery({
			queryKey,
			queryFn,
			meta: sessionScopedQueryMeta,
			staleTime: Infinity
		});

		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn,
			meta: sessionScopedQueryMeta,
			enabled: false
		});
		const unsubscribe = observer.subscribe(() => undefined);

		await resetSessionScopedQueries(queryClient);

		expect(queryClient.getQueryData(queryKey)).toBeUndefined();
		expect(queryClient.getQueryCache().find({ queryKey })).toBeDefined();
		expect(queryFn).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it("передаёт между вкладками только команду сброса", async () => {
		installWindowRuntime();
		const queryClient = createQueryClient();
		const foreignChannel = new FakeBroadcastChannel("app:test:session-cache");
		const received: unknown[] = [];
		foreignChannel.onmessage = (event) => received.push(event.data);
		const { cleanup } = installSessionScopedQueryReset(queryClient, {
			channelName: "app:test:session-cache"
		});

		await resetSessionScopedQueries(queryClient);

		expect(received).toEqual([{ type: "session-scoped-query-cache-reset" }]);
		cleanup();
		foreignChannel.close();
	});

	it("обрабатывает входящий сброс без повторной рассылки", async () => {
		installWindowRuntime();
		const queryClient = createQueryClient();
		const queryKey = ["remote-session"] as const;
		await queryClient.fetchQuery({
			queryKey,
			queryFn: () => "данные сессии",
			meta: sessionScopedQueryMeta
		});

		const { cleanup } = installSessionScopedQueryReset(queryClient, {
			channelName: "app:test:remote-session-cache"
		});
		const foreignChannel = new FakeBroadcastChannel("app:test:remote-session-cache");
		const received: unknown[] = [];
		foreignChannel.onmessage = (event) => received.push(event.data);

		foreignChannel.postMessage({ type: "session-scoped-query-cache-reset" });

		await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toBeUndefined());
		expect(received).toEqual([]);
		cleanup();
		foreignChannel.close();
	});

	it("не требует браузерных API при SSR", async () => {
		const queryClient = createQueryClient();
		const installed = installSessionScopedQueryReset(queryClient, {
			channelName: "app:test:ssr"
		});

		expect(() => installed.cleanup()).not.toThrow();
		await expect(resetSessionScopedQueries(queryClient)).resolves.toBeUndefined();
	});
});
