// @vitest-environment jsdom

import { act, createElement, StrictMode, useRef } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVisualViewportFrame } from "../index";

import { attachVisualViewportFrame } from "./attachVisualViewportFrame";

let root: Root | undefined;
let viewport: EventTarget & { offsetTop: number; offsetLeft: number; width: number; height: number; scale: number };
let container: HTMLDivElement;
let sequence = 0;
const frames = new Map<number, FrameRequestCallback>();
const cleanups: Array<() => void> = [];

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	viewport = Object.assign(new EventTarget(), { offsetTop: 40, offsetLeft: 3, width: 390, height: 440, scale: 1 });
	vi.stubGlobal("visualViewport", viewport);
	vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
		frames.set(++sequence, callback);
		return sequence;
	});
	vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
		frames.delete(id);
	});
	container = document.body.appendChild(document.createElement("div"));
});

afterEach(() => {
	act(() => root?.unmount());
	root = undefined;
	for (const cleanup of cleanups.splice(0)) cleanup();
	frames.clear();
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function flushFrame(): void {
	const callbacks = [...frames.values()];
	frames.clear();
	act(() => callbacks.forEach((callback) => callback(0)));
}

function Probe({ active }: { active: boolean }) {
	const ref = useRef<HTMLDivElement>(null);
	useVisualViewportFrame({ active, containerRef: ref });
	return <div ref={ref} data-frame />;
}

describe("visual viewport frame", () => {
	it("общий portal root остаётся подписанным до последнего consumer", () => {
		const first = attachVisualViewportFrame(container);
		const second = attachVisualViewportFrame(container);
		cleanups.push(first, second);
		first();
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("440px");
		viewport.height = 320;
		viewport.dispatchEvent(new Event("resize"));
		flushFrame();
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("320px");
		second();
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("");
	});
	it("пишет смещение и размеры; объединяет resize/scroll в один frame", () => {
		cleanups.push(attachVisualViewportFrame(container));
		expect(container.style.getPropertyValue("--visual-viewport-top")).toBe("40px");
		expect(container.style.getPropertyValue("--visual-viewport-left")).toBe("3px");
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("440px");
		viewport.offsetTop = 120;
		viewport.height = 300;
		viewport.dispatchEvent(new Event("resize"));
		viewport.dispatchEvent(new Event("scroll"));
		window.dispatchEvent(new Event("resize"));
		expect(frames.size).toBe(1);
		flushFrame();
		expect(container.style.getPropertyValue("--visual-viewport-top")).toBe("120px");
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("300px");
	});

	it("уважает zero size и pinch zoom, не добавляя обратный transform", () => {
		viewport.width = 0;
		viewport.height = 0;
		viewport.scale = 2;
		cleanups.push(attachVisualViewportFrame(container));
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("0px");
		expect(container.style.getPropertyValue("--visual-viewport-width")).toBe("0px");
		expect(container.style.transform).toBe("");
		viewport.width = 195;
		viewport.dispatchEvent(new Event("resize"));
		flushFrame();
		expect(container.style.getPropertyValue("--visual-viewport-width")).toBe("195px");
	});

	it("без API использует размеры window и реагирует на resize", () => {
		vi.stubGlobal("visualViewport", undefined);
		vi.spyOn(window, "innerHeight", "get").mockReturnValue(700);
		cleanups.push(attachVisualViewportFrame(container));
		expect(container.style.getPropertyValue("--visual-viewport-top")).toBe("0px");
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("700px");
		vi.spyOn(window, "innerHeight", "get").mockReturnValue(400);
		window.dispatchEvent(new Event("resize"));
		flushFrame();
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("400px");
	});

	it("не распространяет NaN, восстанавливает исходные styles и отменяет queued frame", () => {
		viewport.height = Number.NaN;
		container.style.setProperty("--visual-viewport-top", "7px", "important");
		const detach = attachVisualViewportFrame(container);
		cleanups.push(detach);
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe(`${window.innerHeight}px`);
		viewport.dispatchEvent(new Event("scroll"));
		detach();
		expect(frames.size).toBe(0);
		expect(container.style.getPropertyValue("--visual-viewport-top")).toBe("7px");
		expect(container.style.getPropertyPriority("--visual-viewport-top")).toBe("important");
		expect(container.style.getPropertyValue("--visual-viewport-height")).toBe("");
		viewport.dispatchEvent(new Event("scroll"));
		expect(frames.size).toBe(0);
	});

	it("не восстанавливает CSS-свойство поверх нового внешнего owner", () => {
		const detach = attachVisualViewportFrame(container);
		container.style.setProperty("--visual-viewport-top", "99px");
		detach();
		expect(container.style.getPropertyValue("--visual-viewport-top")).toBe("99px");
	});

	it("hook симметричен в StrictMode и при active toggle", () => {
		root = createRoot(container);
		act(() => root?.render(createElement(StrictMode, null, createElement(Probe, { active: true }))));
		const panel = container.querySelector<HTMLElement>("[data-frame]");
		expect(panel?.style.getPropertyValue("--visual-viewport-height")).toBe("440px");
		act(() => root?.render(createElement(StrictMode, null, createElement(Probe, { active: false }))));
		expect(panel?.style.getPropertyValue("--visual-viewport-height")).toBe("");
		viewport.dispatchEvent(new Event("scroll"));
		expect(frames.size).toBe(0);
	});

	it("ожидает отложенный portal ref и прекращает ожидание при unmount", () => {
		const ref: { current: HTMLElement | null } = { current: null };
		function DelayedProbe() {
			useVisualViewportFrame({ active: true, containerRef: ref });
			return null;
		}
		root = createRoot(container);
		act(() => root?.render(createElement(DelayedProbe)));
		expect(frames.size).toBe(1);
		ref.current = document.body.appendChild(document.createElement("section"));
		flushFrame();
		expect(ref.current.style.getPropertyValue("--visual-viewport-height")).toBe("440px");
		act(() => root?.unmount());
		root = undefined;
		expect(ref.current.style.getPropertyValue("--visual-viewport-height")).toBe("");
		expect(frames.size).toBe(0);
	});
});
