// @vitest-environment jsdom

import React, { act, useRef } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadFileFromBlob, downloadFileFromJson, downloadFileFromObjectURL } from "./downloadFile";
import { getOrCreatePortalRoot } from "./getOrCreatePortalRoot";
import { useClickOutside } from "./useClickOutside";
import { useElementHeightObserver } from "./useElementHeightObserver";
import { useEscapeDismiss } from "./useEscapeDismiss";
import { useIntersectionObserver } from "./useIntersectionObserver";
import { useIsTouchDevice } from "./useIsTouchDevice";
import { useOverlayFocus } from "./useOverlayFocus";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(element: React.ReactElement) {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);

	await act(async () => {
		root?.render(element);
	});

	return container;
}

function cleanupRoot() {
	act(() => {
		root?.unmount();
	});
	root = null;
	container?.remove();
	container = null;
	document.body.innerHTML = "";
}

beforeEach(() => {
	document.body.innerHTML = "";
	Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
		configurable: true,
		value: true
	});
});

afterEach(() => {
	cleanupRoot();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(globalThis, "ResizeObserver");
	Reflect.deleteProperty(globalThis, "IntersectionObserver");
	Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

describe("dom helpers", () => {
	it("создает portal root один раз и переиспользует существующий HTMLElement", () => {
		const first = getOrCreatePortalRoot("portal-root");
		const second = getOrCreatePortalRoot("portal-root");

		expect(first).toBeInstanceOf(HTMLElement);
		expect(second).toBe(first);
		expect(document.body.querySelectorAll("#portal-root")).toHaveLength(1);
	});

	it("скачивает object URL и освобождает его после click", () => {
		vi.useFakeTimers();
		const revokeObjectURL = vi.fn();
		const click = vi.fn();
		const createElement = vi.spyOn(document, "createElement");
		createElement.mockImplementation((tagName: string) => {
			const element = Document.prototype.createElement.call(document, tagName);
			if (tagName === "a") {
				vi.spyOn(element as HTMLAnchorElement, "click").mockImplementation(click);
			}
			return element;
		});
		vi.stubGlobal("URL", {
			...window.URL,
			createObjectURL: vi.fn(() => "blob:test"),
			revokeObjectURL
		});

		downloadFileFromObjectURL("report.txt", "blob:test");
		expect(click).toHaveBeenCalledOnce();
		vi.runAllTimers();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");

		downloadFileFromBlob("report.txt", new Blob(["text"]));
		downloadFileFromJson("report.json", { ok: true });
		expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
	});
});

describe("dom hooks", () => {
	it("useClickOutside вызывает handler только для клика вне всех ref", async () => {
		const handler = vi.fn();

		function Demo() {
			const firstRef = useRef<HTMLButtonElement>(null);
			const secondRef = useRef<HTMLButtonElement>(null);
			useClickOutside([firstRef, secondRef], handler);

			return React.createElement(
				"div",
				null,
				React.createElement("button", { ref: firstRef, type: "button" }, "Первый"),
				React.createElement("button", { ref: secondRef, type: "button" }, "Второй"),
				React.createElement("span", { id: "outside" }, "Снаружи")
			);
		}

		await render(React.createElement(Demo));

		document.querySelector("button")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		expect(handler).not.toHaveBeenCalled();

		document.getElementById("outside")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		expect(handler).toHaveBeenCalledOnce();
	});

	it("useEscapeDismiss закрывает только активный overlay с фокусом внутри контейнера", async () => {
		const onDismiss = vi.fn();

		function Demo() {
			const containerRef = useRef<HTMLDivElement>(null);
			useEscapeDismiss({ active: true, onDismiss, containerRef });

			return React.createElement(
				"div",
				null,
				React.createElement("button", { type: "button", id: "outside" }, "Снаружи"),
				React.createElement("div", { ref: containerRef }, React.createElement("button", { type: "button", id: "inside" }, "Внутри"))
			);
		}

		await render(React.createElement(Demo));

		document.getElementById("outside")?.focus();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
		expect(onDismiss).not.toHaveBeenCalled();

		document.getElementById("inside")?.focus();
		const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
		document.dispatchEvent(event);

		expect(onDismiss).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(true);
	});

	it("useOverlayFocus выставляет начальный фокус, зацикливает Tab и восстанавливает прежний фокус", async () => {
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 1;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

		function Demo({ active }: { active: boolean }) {
			const triggerRef = useRef<HTMLButtonElement>(null);
			const overlayRef = useOverlayFocus<HTMLDivElement>({
				active,
				trapFocus: true,
				restoreFocus: true,
				restoreFocusTarget: () => triggerRef.current
			});

			return React.createElement(
				"div",
				null,
				React.createElement("button", { ref: triggerRef, type: "button", id: "trigger" }, "Открыть"),
				active
					? React.createElement(
							"div",
							{ ref: overlayRef, tabIndex: -1 },
							React.createElement("button", { type: "button", id: "first", autoFocus: true }, "Первый"),
							React.createElement("button", { type: "button", id: "last" }, "Последний")
						)
					: null
			);
		}

		await render(React.createElement(Demo, { active: false }));
		document.getElementById("trigger")?.focus();

		await act(async () => {
			root?.render(React.createElement(Demo, { active: true }));
		});

		const first = document.getElementById("first");
		const last = document.getElementById("last");
		expect(document.activeElement).toBe(first);

		last?.focus();
		last?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
		expect(document.activeElement).toBe(first);

		first?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
		expect(document.activeElement).toBe(last);

		await act(async () => {
			root?.render(React.createElement(Demo, { active: false }));
		});

		expect(document.activeElement).toBe(document.getElementById("trigger"));
	});

	it("useElementHeightObserver читает высоту из ResizeObserver", async () => {
		let resizeCallback: ResizeObserverCallback | undefined;
		class FakeResizeObserver {
			constructor(callback: ResizeObserverCallback) {
				resizeCallback = callback;
			}

			observe = vi.fn();
			disconnect = vi.fn();
		}
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);

		function Demo() {
			const ref = useRef<HTMLDivElement>(null);
			const height = useElementHeightObserver(ref);
			return React.createElement("div", { ref, "data-height": String(height) }, String(height));
		}

		const node = await render(React.createElement(Demo));
		await act(async () => {
			resizeCallback?.([{ contentRect: { height: 42 } } as ResizeObserverEntry], {} as ResizeObserver);
		});

		expect(node.textContent).toBe("42");
	});

	it("useIntersectionObserver обновляет состояние пересечения", async () => {
		let intersectionCallback: IntersectionObserverCallback | undefined;
		class FakeIntersectionObserver {
			constructor(callback: IntersectionObserverCallback) {
				intersectionCallback = callback;
			}

			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		}
		vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

		function Demo() {
			const ref = useRef<HTMLDivElement>(null);
			const { isIntersecting } = useIntersectionObserver(ref);
			return React.createElement("div", { ref }, isIntersecting ? "visible" : "hidden");
		}

		const node = await render(React.createElement(Demo));
		expect(node.textContent).toBe("hidden");

		await act(async () => {
			intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		});

		expect(node.textContent).toBe("visible");
	});

	it("useIsTouchDevice реагирует на coarse pointer и resize", async () => {
		let coarse = true;
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn(
				() =>
					({
						matches: coarse,
						media: "(pointer: coarse)",
						addEventListener: vi.fn(),
						removeEventListener: vi.fn()
					}) as unknown as MediaQueryList
			)
		});
		Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });

		function Demo() {
			return React.createElement("span", null, useIsTouchDevice() ? "touch" : "mouse");
		}

		const node = await render(React.createElement(Demo));
		expect(node.textContent).toBe("touch");

		coarse = false;
		await act(async () => {
			Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 1 });
			window.dispatchEvent(new Event("resize"));
			await Promise.resolve();
		});

		expect(window.matchMedia).toHaveBeenCalledTimes(2);
		expect(node.textContent).toBe("touch");
	});
});
