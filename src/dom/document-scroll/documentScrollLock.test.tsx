// @vitest-environment jsdom

import { act, createElement, StrictMode } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDocumentScrollLock } from "../index";

import { acquireDocumentScrollLock } from "./acquireDocumentScrollLock";

let root: Root | undefined;
const cleanups: Array<() => void> = [];

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	vi.spyOn(window, "scrollX", "get").mockReturnValue(17);
	vi.spyOn(window, "scrollY", "get").mockReturnValue(345);
	vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
	vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1000);
});

afterEach(() => {
	act(() => root?.unmount());
	root = undefined;
	for (const cleanup of cleanups.splice(0)) cleanup();
	document.body.removeAttribute("style");
	document.documentElement.removeAttribute("style");
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function acquire(compensate = false): () => void {
	const release = acquireDocumentScrollLock(document, compensate);
	cleanups.push(release);
	return release;
}

function Probe({ active, documentTarget }: { active: boolean; documentTarget?: Document | null }) {
	useDocumentScrollLock({ active, documentTarget });
	return null;
}

describe("общая блокировка документа", () => {
	it.each([true, false])("вложенные leases освобождают документ только последними, порядок %s", (firstClosesFirst) => {
		const first = acquire();
		const second = acquire();
		expect(document.body.style.position).toBe("fixed");
		expect(document.body.style.top).toBe("-345px");
		expect(document.body.style.left).toBe("-17px");
		expect(document.documentElement.style.overflow).toBe("hidden");
		(firstClosesFirst ? first : second)();
		expect(document.body.style.position).toBe("fixed");
		expect(window.scrollTo).not.toHaveBeenCalled();
		(firstClosesFirst ? second : first)();
		expect(document.body.style.position).toBe("");
		expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 17, top: 345, behavior: "instant" });
		first();
		second();
		expect(window.scrollTo).toHaveBeenCalledOnce();
	});

	it("восстанавливает прежние значения и priority, не теряя посторонние inline изменения", () => {
		document.body.style.setProperty("position", "relative", "important");
		document.body.style.setProperty("top", "6px");
		document.body.style.setProperty("padding-right", "8px", "important");
		document.documentElement.style.setProperty("overflow", "scroll", "important");
		const release = acquire(true);
		document.body.style.setProperty("color", "red");
		release();
		expect(document.body.style.position).toBe("relative");
		expect(document.body.style.getPropertyPriority("position")).toBe("important");
		expect(document.body.style.top).toBe("6px");
		expect(document.body.style.paddingRight).toBe("8px");
		expect(document.body.style.getPropertyPriority("padding-right")).toBe("important");
		expect(document.body.style.color).toBe("red");
		expect(document.documentElement.style.overflow).toBe("scroll");
		expect(document.documentElement.style.getPropertyPriority("overflow")).toBe("important");
	});

	it("компенсирует scrollbar пока есть хотя бы один запрос и сохраняет исходный padding", () => {
		document.body.style.paddingRight = "8px";
		const first = acquire();
		const second = acquire(true);
		expect(document.body.style.paddingRight).toBe("32px");
		second();
		expect(document.body.style.position).toBe("fixed");
		expect(document.body.style.paddingRight).toBe("8px");
		first();
	});

	it("не добавляет padding для нулевого scrollbar", () => {
		vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1024);
		acquire(true);
		expect(document.body.style.paddingRight).toBe("");
	});

	it("сохраняет независимые overflow longhands", () => {
		document.documentElement.style.setProperty("overflow-x", "hidden", "important");
		document.documentElement.style.setProperty("overflow-y", "scroll");
		const release = acquire();
		release();
		expect(document.documentElement.style.overflowX).toBe("hidden");
		expect(document.documentElement.style.getPropertyPriority("overflow-x")).toBe("important");
		expect(document.documentElement.style.overflowY).toBe("scroll");
	});

	it("разные документы не делят счетчик leases", () => {
		const iframe = document.body.appendChild(document.createElement("iframe"));
		const other = iframe.contentDocument;
		if (!other?.defaultView) throw new Error("Нет документа iframe");
		vi.spyOn(other.defaultView, "scrollTo").mockImplementation(() => undefined);
		const release = acquire();
		const releaseOther = acquireDocumentScrollLock(other, false);
		cleanups.push(releaseOther);
		release();
		expect(document.body.style.position).toBe("");
		expect(other.body.style.position).toBe("fixed");
		releaseOther();
		expect(other.body.style.position).toBe("");
	});

	it("явный null и документ без defaultView не создают lock", () => {
		const other = document.implementation.createHTMLDocument();
		acquireDocumentScrollLock(other, true)();
		expect(other.body.style.position).toBe("");
		root = createRoot(document.body.appendChild(document.createElement("div")));
		act(() => root?.render(createElement(Probe, { active: true, documentTarget: null })));
		expect(document.body.style.position).toBe("");
	});

	it("hook переносит lifecycle через StrictMode, active toggle и unmount", () => {
		root = createRoot(document.body.appendChild(document.createElement("div")));
		act(() => root?.render(createElement(StrictMode, null, createElement(Probe, { active: true }))));
		expect(document.body.style.position).toBe("fixed");
		act(() => root?.render(createElement(StrictMode, null, createElement(Probe, { active: false }))));
		expect(document.body.style.position).toBe("");
		act(() => root?.render(createElement(StrictMode, null, createElement(Probe, { active: true }))));
		expect(document.body.style.position).toBe("fixed");
		act(() => root?.unmount());
		root = undefined;
		expect(document.body.style.position).toBe("");
	});
});
