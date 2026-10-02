import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
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
	it.each([
		{ consumeSignal: true, cached: false, repeated: false },
		{ consumeSignal: false, cached: false, repeated: false },
		{ consumeSignal: true, cached: true, repeated: false },
		{ consumeSignal: true, cached: false, repeated: true }
	])("отменяет pending GET до remote refetch: $consumeSignal/$cached/$repeated", async ({ consumeSignal, cached, repeated }) => {
		installBrowserRuntime();
		const sender = createClient();
		const receiver = createClient();
		const key = ["timetable", "week", "main", 2026];
		const options = { channelName: "app:test:invalidation:cold", matchesQuery: matchesTimetableWeek };
		const first = installQueryInvalidationBroadcast(sender, options);
		const second = installQueryInvalidationBroadcast(receiver, options);
		const wire = vi.spyOn(FakeBroadcastChannel.prototype, "postMessage");
		let completeOldRead: (value: string) => void = () => {
			throw new Error("GET ещё не запущен");
		};
		const oldRead = new Promise<string>((resolve) => {
			completeOldRead = resolve;
		});
		let completeIntermediateRead: (value: string) => void = () => {
			throw new Error("GET ещё не запущен");
		};
		const intermediateRead = new Promise<string>((resolve) => {
			completeIntermediateRead = resolve;
		});
		let oldSignal: AbortSignal | undefined;
		let reads = 0;
		if (cached) receiver.setQueryData(key, "cached");
		const observer = new QueryObserver(receiver, {
			queryKey: key,
			staleTime: 0,
			queryFn: (context) => {
				reads += 1;
				if (reads === 1) {
					if (consumeSignal) oldSignal = context.signal;
					return oldRead;
				}
				return repeated && reads === 2 ? intermediateRead : Promise.resolve("after-commit");
			}
		});
		const unsubscribe = observer.subscribe(() => undefined);
		try {
			expect(reads).toBe(1);
			first.broadcast(key);
			if (repeated) first.broadcast(key);
			await vi.waitFor(() => expect(receiver.getQueryData(key)).toBe("after-commit"));
			expect(reads).toBe(repeated ? 3 : 2);
			if (consumeSignal) expect(oldSignal?.aborted).toBe(true);
			completeOldRead("before-commit");
			await oldRead;
			if (repeated) {
				completeIntermediateRead("intermediate-commit");
				await intermediateRead;
			}
			await Promise.resolve();
			expect(receiver.getQueryData(key)).toBe("after-commit");
			expect(wire).toHaveBeenCalledTimes(repeated ? 2 : 1);
		} finally {
			unsubscribe();
			observer.destroy();
			first.cleanup();
			second.cleanup();
			sender.clear();
			receiver.clear();
			wire.mockRestore();
		}
	});

	it("при refetchType none отменяет active cold GET без нового чтения", async () => {
		installBrowserRuntime();
		const client = createClient();
		const key = ["timetable", "week", "main", 2026];
		const installed = installQueryInvalidationBroadcast(client, {
			channelName: "app:test:invalidation:cancel-without-refetch",
			matchesQuery: matchesTimetableWeek,
			refetchType: "none"
		});
		const foreign = new FakeBroadcastChannel("app:test:invalidation:cancel-without-refetch");
		let completeRead: (value: string) => void = () => {
			throw new Error("GET ещё не запущен");
		};
		const pending = new Promise<string>((resolve) => {
			completeRead = resolve;
		});
		const read = vi.fn(() => pending);
		const observer = new QueryObserver(client, { queryKey: key, queryFn: read });
		const unsubscribe = observer.subscribe(() => undefined);
		try {
			foreign.postMessage({ type: "query.invalidate", senderId: "foreign", queryKey: key });
			completeRead("before-commit");
			await pending;
			await Promise.resolve();
			expect(read).toHaveBeenCalledTimes(1);
			expect(client.getQueryData(key)).toBeUndefined();
			expect(client.getQueryState(key)?.isInvalidated).toBe(true);
		} finally {
			unsubscribe();
			observer.destroy();
			installed.cleanup();
			foreign.close();
			client.clear();
		}
	});

	it("отменяет только точный incoming key и сохраняет refetchType none", async () => {
		installBrowserRuntime();
		const client = createClient();
		const key = ["timetable", "week", "main", 2026];
		const otherKey = ["timetable", "week", "other", 2026];
		const installed = installQueryInvalidationBroadcast(client, {
			channelName: "app:test:invalidation:exact-cancel",
			matchesQuery: matchesTimetableWeek,
			refetchType: "none"
		});
		const foreign = new FakeBroadcastChannel("app:test:invalidation:exact-cancel");
		const cancel = vi.spyOn(client, "cancelQueries");
		let completeRead: (value: string) => void = () => {
			throw new Error("GET ещё не запущен");
		};
		const pending = new Promise<string>((resolve) => {
			completeRead = resolve;
		});
		let signal: AbortSignal | undefined;
		const read = client.fetchQuery({
			queryKey: otherKey,
			queryFn: (context) => {
				signal = context.signal;
				return pending;
			}
		});
		try {
			client.setQueryData(key, "old");
			foreign.postMessage({ type: "query.invalidate", senderId: "foreign", queryKey: key });
			expect(cancel).toHaveBeenCalledExactlyOnceWith({ queryKey: key, exact: true });
			expect(signal?.aborted).toBe(false);
			expect(client.getQueryData(key)).toBe("old");
			expect(client.getQueryState(key)?.isInvalidated).toBe(true);
			completeRead("unrelated");
			await expect(read).resolves.toBe("unrelated");
			installed.cleanup();
			foreign.postMessage({ type: "query.invalidate", senderId: "foreign", queryKey: key });
			expect(cancel).toHaveBeenCalledTimes(1);
		} finally {
			installed.cleanup();
			foreign.close();
			client.clear();
		}
	});

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
