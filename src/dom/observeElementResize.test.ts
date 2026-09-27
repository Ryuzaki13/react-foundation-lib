// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observeElementResize } from "./index";

let deliver: ResizeObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();
class FakeResizeObserver {
	constructor(callback: ResizeObserverCallback) {
		deliver = callback;
	}
	observe = observe;
	disconnect = disconnect;
	unobserve = vi.fn();
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => vi.unstubAllGlobals());

describe("observeElementResize", () => {
	it("вызывает callback один раз за delivery выбранного element, включая нулевой размер", () => {
		const element = document.createElement("div");
		const onResize = vi.fn();
		const cleanup = observeElementResize(element, onResize);
		const observer = new FakeResizeObserver(deliver);
		const entry: ResizeObserverEntry = {
			target: element,
			contentRect: new DOMRect(0, 0, 0, 0),
			borderBoxSize: [],
			contentBoxSize: [],
			devicePixelContentBoxSize: []
		};
		expect(observe).toHaveBeenCalledExactlyOnceWith(element);
		expect(onResize).not.toHaveBeenCalled();
		deliver([entry, entry], observer);
		expect(onResize).toHaveBeenCalledOnce();
		cleanup();
	});

	it("не вызывает callback после cleanup, при пустой или чужой delivery", () => {
		const onResize = vi.fn();
		const element = document.createElement("div");
		const cleanup = observeElementResize(element, onResize);
		const observer = new FakeResizeObserver(deliver);
		deliver([], observer);
		const entry: ResizeObserverEntry = {
			target: document.createElement("div"),
			contentRect: new DOMRect(),
			borderBoxSize: [],
			contentBoxSize: [],
			devicePixelContentBoxSize: []
		};
		deliver([entry], observer);
		cleanup();
		cleanup();
		deliver([{ ...entry, target: element }], observer);
		expect(onResize).not.toHaveBeenCalled();
		expect(disconnect).toHaveBeenCalledOnce();
	});

	it("не скрывает ошибку consumer callback", () => {
		const element = document.createElement("div");
		const failure = new Error("Сбой consumer");
		const cleanup = observeElementResize(element, () => {
			throw failure;
		});
		const observer = new FakeResizeObserver(deliver);
		const entry: ResizeObserverEntry = {
			target: element,
			contentRect: new DOMRect(),
			borderBoxSize: [],
			contentBoxSize: [],
			devicePixelContentBoxSize: []
		};
		expect(() => deliver([entry], observer)).toThrow(failure);
		cleanup();
	});

	it("без ResizeObserver не обращается к DOM и возвращает безопасный cleanup", () => {
		vi.stubGlobal("ResizeObserver", undefined);
		const onResize = vi.fn();
		const cleanup = observeElementResize(document.createElement("div"), onResize);
		cleanup();
		expect(onResize).not.toHaveBeenCalled();
		expect(observe).not.toHaveBeenCalled();
	});
});
