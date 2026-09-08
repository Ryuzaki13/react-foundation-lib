// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useBrowserOnlineStatus } from "./useBrowserOnlineStatus";

let container: HTMLDivElement;
let root: Root;

function Probe() {
	const online = useBrowserOnlineStatus();
	return createElement("output", { "data-online": online ? "true" : "false" });
}

describe("useBrowserOnlineStatus", () => {
	beforeEach(() => {
		container = document.createElement("div");
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
	});

	it("обновляет snapshot по browser online/offline событиям", async () => {
		Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
		await act(async () => root.render(createElement(Probe)));
		expect(container.querySelector("output")?.dataset.online).toBe("true");

		Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
		act(() => window.dispatchEvent(new Event("offline")));
		expect(container.querySelector("output")?.dataset.online).toBe("false");
	});
});
