import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	installSessionScopedQueryReset,
	installSessionScopedQueryResetLifecycle,
	resetSessionScopedQueries,
	sessionScopedQueryMeta
} from "./index";

import { BroadcastChannel as NodeBroadcastChannel } from "node:worker_threads";

const SESSION_KEY = ["reset-lifecycle-session"] as const;
const PUBLIC_KEY = ["reset-lifecycle-public"] as const;
const cleanups: Array<() => void> = [];

function createClient() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
	cleanups.push(() => client.clear());
	client.setQueryData(PUBLIC_KEY, "public");
	return client;
}

function observeSession(client: QueryClient) {
	const queryFn = vi.fn(async () => "new-session");
	const observer = new QueryObserver(client, {
		queryKey: SESSION_KEY,
		queryFn,
		initialData: "old-session",
		staleTime: Infinity,
		meta: sessionScopedQueryMeta
	});
	cleanups.push(observer.subscribe(() => undefined));
	return queryFn;
}

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("query-client/sessionScopedResetLifecycle", () => {
	it("вызывает все before синхронно и ждёт каждый retirement до cancel/clear/refetch", async () => {
		const client = createClient();
		const queryFn = observeSession(client);
		const cancel = vi.spyOn(client, "cancelQueries");
		const first = Promise.withResolvers<void>();
		const second = Promise.withResolvers<void>();
		const calls: string[] = [];
		for (const [name, gate] of [
			["first", first],
			["second", second]
		] as const) {
			cleanups.push(
				installSessionScopedQueryResetLifecycle(client, {
					beforeReset: () => {
						calls.push(`${name}:before`);
						return gate.promise;
					},
					afterReset: ({ status }) => calls.push(`${name}:after:${status}`)
				}).cleanup
			);
		}

		const reset = resetSessionScopedQueries(client, { broadcast: false });
		expect(calls).toEqual(["first:before", "second:before"]);
		expect(cancel).not.toHaveBeenCalled();
		expect(client.getQueryData(SESSION_KEY)).toBe("old-session");
		first.resolve();
		await Promise.resolve();
		expect(cancel).not.toHaveBeenCalled();
		second.resolve();
		await reset;

		expect(calls).toEqual(["first:before", "second:before", "first:after:completed", "second:after:completed"]);
		expect(cancel).toHaveBeenCalledOnce();
		expect(queryFn).toHaveBeenCalledOnce();
		expect(client.getQueryData(SESSION_KEY)).toBe("new-session");
		expect(client.getQueryData(PUBLIC_KEY)).toBe("public");
	});

	it("не объединяет параллельные reset и держит регистрацию закрытой до последнего завершения", async () => {
		const client = createClient();
		const gates = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
		let begun = 0;
		const after = vi.fn();
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => gates[begun++].promise,
				afterReset: after
			}).cleanup
		);
		const first = resetSessionScopedQueries(client, { broadcast: false });
		const second = resetSessionScopedQueries(client, { broadcast: false });
		expect(begun).toBe(2);
		gates[1].resolve();
		await second;
		expect(after).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
		expect(() =>
			installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined })
		).toThrow();
		gates[0].resolve();
		await first;
		expect(after).toHaveBeenCalledTimes(2);
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined }).cleanup
		);
	});

	it("закрывает late install даже при reset без ранее установленных listeners", async () => {
		const client = createClient();
		const reset = resetSessionScopedQueries(client, { broadcast: false });
		expect(() =>
			installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined })
		).toThrow();
		await reset;
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined }).cleanup
		);
	});

	it("вызывает captured after после cleanup, но не включает listener в следующий reset", async () => {
		const client = createClient();
		const gate = Promise.withResolvers<void>();
		const before = vi.fn(() => gate.promise);
		const after = vi.fn();
		const installed = installSessionScopedQueryResetLifecycle(client, { beforeReset: before, afterReset: after });
		const reset = resetSessionScopedQueries(client, { broadcast: false });
		installed.cleanup();
		installed.cleanup();
		gate.resolve();
		await reset;
		await resetSessionScopedQueries(client, { broadcast: false });

		expect(before).toHaveBeenCalledOnce();
		expect(after).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
	});

	it("повторный старый cleanup не удаляет более позднюю регистрацию", async () => {
		const client = createClient();
		const previous = installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined });
		previous.cleanup();
		const before = vi.fn();
		const after = vi.fn();
		cleanups.push(installSessionScopedQueryResetLifecycle(client, { beforeReset: before, afterReset: after }).cleanup);
		previous.cleanup();

		await resetSessionScopedQueries(client, { broadcast: false });
		expect(before).toHaveBeenCalledOnce();
		expect(after).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
	});

	it("изолирует callbacks разных QueryClient и не использует browser API при SSR", async () => {
		vi.stubGlobal("window", undefined);
		const broadcast = vi.fn(() => {
			throw new Error("SSR не должен создавать канал");
		});
		vi.stubGlobal("BroadcastChannel", broadcast);
		const first = createClient();
		const second = createClient();
		const before = vi.fn();
		const after = vi.fn();
		cleanups.push(installSessionScopedQueryResetLifecycle(first, { beforeReset: before, afterReset: after }).cleanup);
		cleanups.push(installSessionScopedQueryReset(first, { channelName: "lifecycle-ssr" }).cleanup);
		await resetSessionScopedQueries(second);
		expect(before).not.toHaveBeenCalled();
		await resetSessionScopedQueries(first);
		expect(before).toHaveBeenCalledOnce();
		expect(after).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
		expect(broadcast).not.toHaveBeenCalled();
	});

	it("синхронная ошибка before не пропускает соседний retirement и запрещает refetch", async () => {
		const client = createClient();
		const queryFn = observeSession(client);
		const cancel = vi.spyOn(client, "cancelQueries");
		const failure = new Error("retirement failed");
		const gate = Promise.withResolvers<void>();
		const calls: string[] = [];
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => {
					calls.push("throwing");
					throw failure;
				},
				afterReset: ({ status }) => calls.push(`first:${status}`)
			}).cleanup
		);
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => {
					calls.push("waiting");
					return gate.promise;
				},
				afterReset: ({ status }) => calls.push(`second:${status}`)
			}).cleanup
		);
		const reset = resetSessionScopedQueries(client, { broadcast: false }).catch((error: unknown) => error);
		expect(calls).toEqual(["throwing", "waiting"]);
		expect(cancel).not.toHaveBeenCalled();
		gate.resolve();
		expect(await reset).toBe(failure);
		expect(calls).toEqual(["throwing", "waiting", "first:failed", "second:failed"]);
		expect(cancel).toHaveBeenCalledOnce();
		expect(client.getQueryData(SESSION_KEY)).toBeUndefined();
		expect(client.getQueryData(PUBLIC_KEY)).toBe("public");
		expect(queryFn).not.toHaveBeenCalled();
	});

	it("собирает before/after ошибки в порядке регистрации, а не завершения Promise", async () => {
		const client = createClient();
		const beforeFirst = new Error("before first");
		const beforeSecond = new Error("before second");
		const afterFirst = new Error("after first");
		const afterSecond = new Error("after second");
		const gate = Promise.withResolvers<void>();
		const outcomes: string[] = [];
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => gate.promise,
				afterReset: ({ status }) => {
					outcomes.push(status);
					throw afterFirst;
				}
			}).cleanup
		);
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => Promise.reject(beforeSecond),
				afterReset: ({ status }) => {
					outcomes.push(status);
					throw afterSecond;
				}
			}).cleanup
		);
		const reset = resetSessionScopedQueries(client, { broadcast: false }).catch((error: unknown) => error);
		gate.reject(beforeFirst);
		const failure = await reset;

		expect(failure).toBeInstanceOf(AggregateError);
		if (!(failure instanceof AggregateError)) throw new Error("Ожидалась группа ошибок lifecycle");
		expect(failure.errors).toEqual([beforeFirst, beforeSecond, afterFirst, afterSecond]);
		expect(outcomes).toEqual(["failed", "failed"]);
	});

	it("ошибка after не лишает остальные after completed исхода успешного core", async () => {
		const client = createClient();
		const queryFn = observeSession(client);
		const failure = new Error("after failed");
		const outcomes: string[] = [];
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => undefined,
				afterReset: ({ status }) => {
					outcomes.push(status);
					throw failure;
				}
			}).cleanup
		);
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => undefined,
				afterReset: ({ status }) => outcomes.push(status)
			}).cleanup
		);

		await expect(resetSessionScopedQueries(client, { broadcast: false })).rejects.toBe(failure);
		expect(outcomes).toEqual(["completed", "completed"]);
		expect(queryFn).toHaveBeenCalledOnce();
	});

	it("core failure передаётся всем after и не оставляет active marker", async () => {
		const client = createClient();
		const failure = new Error("core refetch failed");
		vi.spyOn(client, "refetchQueries").mockRejectedValueOnce(failure);
		const after = vi.fn();
		cleanups.push(installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: after }).cleanup);
		await expect(resetSessionScopedQueries(client, { broadcast: false })).rejects.toBe(failure);
		expect(after).toHaveBeenCalledExactlyOnceWith({ status: "failed" });
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined }).cleanup
		);
	});

	it("разрешает reentrant reset отдельной парой, но запрещает install внутри before и after", async () => {
		const client = createClient();
		const after = vi.fn();
		let nested: Promise<void> | undefined;
		let begun = 0;
		const late = () => installSessionScopedQueryResetLifecycle(client, { beforeReset: () => undefined, afterReset: () => undefined });
		cleanups.push(
			installSessionScopedQueryResetLifecycle(client, {
				beforeReset: () => {
					expect(late).toThrow();
					if (begun++ === 0) nested = resetSessionScopedQueries(client, { broadcast: false });
				},
				afterReset: (outcome) => {
					expect(late).toThrow();
					after(outcome);
				}
			}).cleanup
		);

		await resetSessionScopedQueries(client, { broadcast: false });
		await nested;
		expect(begun).toBe(2);
		expect(after).toHaveBeenCalledTimes(2);
	});
});

describe("входящий reset через настоящий BroadcastChannel", () => {
	it.each(["callback", "fallback", "throwing-reporter", "rejecting-reporter"] as const)(
		"наблюдает failure через %s без unhandled rejection и ответной рассылки",
		async (reporting) => {
			vi.stubGlobal("window", {});
			vi.stubGlobal("BroadcastChannel", NodeBroadcastChannel);
			const client = createClient();
			const queryFn = observeSession(client);
			const failure = new Error("incoming retirement failed");
			const reporterFailure = new Error("diagnostics failed");
			const after = vi.fn();
			const onError = vi.fn((error: unknown): void | Promise<void> => {
				void error;
				if (reporting === "throwing-reporter") throw reporterFailure;
				if (reporting === "rejecting-reporter") return Promise.reject(reporterFailure);
			});
			const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
			cleanups.push(
				installSessionScopedQueryResetLifecycle(client, {
					beforeReset: () => Promise.reject(failure),
					afterReset: after
				}).cleanup
			);
			const channelName = `lifecycle-incoming-${reporting}`;
			cleanups.push(
				installSessionScopedQueryReset(client, {
					channelName,
					...(reporting === "fallback" ? {} : { onError })
				}).cleanup
			);
			const peer = new NodeBroadcastChannel(channelName);
			cleanups.push(() => peer.close());
			const echoed = vi.fn();
			peer.onmessage = echoed;
			const post = vi.spyOn(NodeBroadcastChannel.prototype, "postMessage");
			peer.postMessage({ type: "session-scoped-query-cache-reset" });
			await vi.waitFor(() => expect(after).toHaveBeenCalledExactlyOnceWith({ status: "failed" }));
			if (reporting === "callback") {
				expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
				expect(consoleError).not.toHaveBeenCalled();
			} else if (reporting === "fallback") {
				await vi.waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
				expect(consoleError.mock.calls[0]).toContain(failure);
			} else {
				await vi.waitFor(() => expect(consoleError).toHaveBeenCalledOnce());
				const combined = consoleError.mock.calls[0].find((value) => value instanceof AggregateError);
				expect(combined).toBeInstanceOf(AggregateError);
				if (!(combined instanceof AggregateError)) throw new Error("Диагностика должна сохранить обе ошибки");
				expect(combined.errors).toEqual([failure, reporterFailure]);
			}
			expect(post).toHaveBeenCalledOnce();
			expect(echoed).not.toHaveBeenCalled();
			expect(queryFn).not.toHaveBeenCalled();
			expect(client.getQueryData(SESSION_KEY)).toBeUndefined();
		}
	);
});
