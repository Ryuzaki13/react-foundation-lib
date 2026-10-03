// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";

import { type VirtualItem } from "@tanstack/react-virtual";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFetchNextPageEffect, type UseFetchNextPageEffectOptions } from "./index";

type FetchGate = Readonly<{ promise: Promise<void>; release: () => void; reject: (error: unknown) => void }>;

/** Управляемое завершение fetch без таймеров и изменений transport callback. */
function createFetchGate(): FetchGate {
	let release: (() => void) | undefined;
	let reject: ((error: unknown) => void) | undefined;
	const promise = new Promise<void>((resolve, rejectPromise) => {
		release = resolve;
		reject = rejectPromise;
	});
	return {
		promise,
		release() {
			if (!release) throw new Error("Fetch gate ещё не создан.");
			release();
		},
		reject(error) {
			if (!reject) throw new Error("Fetch gate ещё не создан.");
			reject(error);
		}
	};
}

function virtualItem(index: number): VirtualItem {
	return { key: `row-${index}`, index, start: index * 40, end: (index + 1) * 40, size: 40, lane: 0 };
}

function Probe(options: UseFetchNextPageEffectOptions) {
	useFetchNextPageEffect(options);
	return null;
}

describe("useFetchNextPageEffect", () => {
	let container: HTMLDivElement;
	let root: Root;
	let gates: FetchGate[];
	const gate = () => {
		const created = createFetchGate();
		gates.push(created);
		return created;
	};
	const render = async (options: UseFetchNextPageEffectOptions) => {
		await act(async () => root.render(createElement(StrictMode, null, createElement(Probe, options))));
	};
	const options = (fetchNextPage: () => Promise<unknown>): UseFetchNextPageEffectOptions => ({
		virtualItems: [virtualItem(9)],
		currentItemsCount: 10,
		hasNextPage: true,
		fetchNextPage
	});
	beforeEach(() => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		container = document.createElement("div");
		root = createRoot(container);
		gates = [];
	});
	afterEach(async () => {
		await act(async () => {
			root.unmount();
			for (const pending of gates) pending.release();
		});
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it.each([
		{ virtualItems: [], currentItemsCount: 10, hasNextPage: true },
		{ virtualItems: [virtualItem(0)], currentItemsCount: 0, hasNextPage: true },
		{ virtualItems: [virtualItem(8)], currentItemsCount: 10, hasNextPage: true },
		{ virtualItems: [virtualItem(9)], currentItemsCount: 10, hasNextPage: false }
	])("не запускает fetch без готового края: %j", async (state) => {
		const fetchNextPage = vi.fn(async () => undefined);
		await render({ ...state, fetchNextPage });
		expect(fetchNextPage).not.toHaveBeenCalled();
	});

	it("не запускает fetch во время SSR", () => {
		const fetchNextPage = vi.fn(async () => undefined);
		renderToString(createElement(Probe, options(fetchNextPage)));
		expect(fetchNextPage).not.toHaveBeenCalled();
	});

	it("StrictMode и новые virtual arrays не дублируют незавершённый fetch", async () => {
		const current = gate();
		const fetchNextPage = vi.fn(() => current.promise);
		await render(options(fetchNextPage));
		await render(options(fetchNextPage));
		await render({ ...options(fetchNextPage), virtualItems: [virtualItem(10)] });
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		await act(async () => current.release());
		expect(console.error).not.toHaveBeenCalled();
	});

	it("после успеха новый край допускает следующую страницу без изменения API", async () => {
		const fetchNextPage = vi.fn(async () => undefined);
		await render(options(fetchNextPage));
		await render({ ...options(fetchNextPage), currentItemsCount: 20, virtualItems: [virtualItem(18)] });
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		await render({ ...options(fetchNextPage), currentItemsCount: 20, virtualItems: [virtualItem(19)] });
		expect(fetchNextPage).toHaveBeenCalledTimes(2);
	});

	it("обрабатывает rejection один раз без unhandled Promise и автоповтора failed page", async () => {
		const error = new Error("fetch failed");
		const fetchNextPage = vi.fn(() => Promise.reject(error));
		const onError = vi.fn();
		await render({ ...options(fetchNextPage), onError });
		await render({ ...options(fetchNextPage), onError });
		await render({ ...options(() => fetchNextPage()), virtualItems: [virtualItem(10)], onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(console.error).not.toHaveBeenCalled();
	});

	it("без onError сохраняет исходный отказ в явной диагностике", async () => {
		const error = new Error("fetch failed");
		await render(options(() => Promise.reject(error)));
		expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), error);
	});

	it("синхронный throw fetch также обрабатывается и блокирует ту же failed page", async () => {
		const error = new Error("sync fetch failed");
		const fetchNextPage = vi.fn((): Promise<unknown> => {
			throw error;
		});
		const onError = vi.fn();
		await render({ ...options(fetchNextPage), onError });
		await render({ ...options(fetchNextPage), onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
	});

	it.each(["sync", "async"])("отказ %s onError не становится unhandled и остаётся диагностикой", async (kind) => {
		const fetchError = new Error("fetch failed");
		const reporterError = new Error("reporter failed");
		const onError = vi.fn(() => {
			if (kind === "sync") throw reporterError;
			return Promise.reject(reporterError);
		});
		await render({ ...options(() => Promise.reject(fetchError)), onError });
		expect(onError).toHaveBeenCalledExactlyOnceWith(fetchError);
		expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), fetchError, reporterError);
	});

	it("ждёт async onError и не запускает параллельный fetch", async () => {
		const reporter = gate();
		const error = new Error("fetch failed");
		const fetchNextPage = vi.fn(() => Promise.reject(error));
		const onError = vi.fn(() => reporter.promise);
		await render({ ...options(fetchNextPage), onError });
		await render({ ...options(fetchNextPage), currentItemsCount: 20, virtualItems: [virtualItem(19)], onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		await act(async () => reporter.release());
		await render({ ...options(fetchNextPage), currentItemsCount: 20, virtualItems: [virtualItem(19)], onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(2);
	});

	it("изменение числа загруженных строк разрешает попытку после отказа", async () => {
		const fetchNextPage = vi.fn(() => Promise.reject(new Error("fetch failed")));
		const onError = vi.fn();
		await render({ ...options(fetchNextPage), onError });
		await render({ ...options(fetchNextPage), currentItemsCount: 20, virtualItems: [virtualItem(19)], onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(2);
	});

	it("явное выключение и включение pagination снимает failed-page latch", async () => {
		const fetchNextPage = vi.fn(() => Promise.reject(new Error("fetch failed")));
		const onError = vi.fn();
		await render({ ...options(fetchNextPage), onError });
		await render({ ...options(fetchNextPage), hasNextPage: false, onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		await render({ ...options(fetchNextPage), onError });
		expect(fetchNextPage).toHaveBeenCalledTimes(2);
	});

	it("после unmount не отменяет transport и не вызывает UI onError, но сохраняет отказ", async () => {
		const current = gate();
		const error = new Error("late fetch failed");
		const fetchNextPage = vi.fn(() => current.promise);
		const onError = vi.fn();
		await render({ ...options(fetchNextPage), onError });
		await act(async () => root.unmount());
		await act(async () => current.reject(error));
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
		expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), error);
	});

	it("поздний отказ уже начатого onError сохраняет обе ошибки после unmount", async () => {
		const reporter = gate();
		const fetchError = new Error("fetch failed");
		const reporterError = new Error("late reporter failed");
		const onError = vi.fn(() => reporter.promise);
		await render({ ...options(() => Promise.reject(fetchError)), onError });
		await act(async () => root.unmount());
		await act(async () => reporter.reject(reporterError));
		expect(onError).toHaveBeenCalledExactlyOnceWith(fetchError);
		expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), fetchError, reporterError);
	});
});
