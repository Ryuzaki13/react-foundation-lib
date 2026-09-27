import { createElement, useRef } from "react";

import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";

import { observeElementResize, useDocumentScrollLock, useVisualViewportFrame } from "./index";

function Probe() {
	const containerRef = useRef<HTMLDivElement>(null);
	useDocumentScrollLock({ active: true });
	useVisualViewportFrame({ active: true, containerRef });
	return createElement("div");
}

it("viewport hooks импортируются и рендерятся без browser globals", () => {
	expect(typeof window).toBe("undefined");
	expect(typeof document).toBe("undefined");
	expect(typeof observeElementResize).toBe("function");
	expect(renderToString(createElement(Probe))).toBe("<div></div>");
});
