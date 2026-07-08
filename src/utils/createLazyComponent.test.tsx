// @vitest-environment jsdom

import React, { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLazyComponent } from "./createLazyComponent";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(element: React.ReactElement) {
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);

	await act(async () => {
		root?.render(element);
	});

	await act(async () => {
		await Promise.resolve();
	});

	return container;
}

afterEach(() => {
	act(() => {
		root?.unmount();
	});
	root = null;
	container?.remove();
	container = null;
	document.body.innerHTML = "";
});

describe("createLazyComponent", () => {
	it("кеширует lazy component по import function и имени компонента", () => {
		const Demo: React.FC<unknown> = () => React.createElement("span", null, "Demo");
		const importFn = vi.fn(async () => ({ Demo }));

		const first = createLazyComponent(importFn, "Demo");
		const second = createLazyComponent(importFn, "Demo");
		const another = createLazyComponent(importFn, "Another");

		expect(second).toBe(first);
		expect(another).not.toBe(first);
	});

	it("кеширует lazy component по явному cacheKey даже для разных import function", () => {
		const Demo: React.FC<unknown> = () => React.createElement("span", null, "Demo");
		const firstImport = vi.fn(async () => ({ Demo }));
		const secondImport = vi.fn(async () => ({ Demo }));

		const first = createLazyComponent(firstImport, "Demo", "shared-demo");
		const second = createLazyComponent(secondImport, "Demo", "shared-demo");

		expect(second).toBe(first);
	});

	it("рендерит именованный компонент из lazy module", async () => {
		const Demo: React.FC<unknown> = () => React.createElement("span", null, "Готово");
		const LazyDemo = createLazyComponent(async () => ({ Demo }), "Demo");

		const node = await render(
			React.createElement(Suspense, { fallback: React.createElement("span", null, "Загрузка") }, React.createElement(LazyDemo))
		);

		expect(node.textContent).toBe("Готово");
	});

	it("использует default export, если именованный компонент не найден", async () => {
		const DefaultComponent: React.FC<unknown> = () => React.createElement("span", null, "Default");
		const LazyDemo = createLazyComponent(async () => ({ default: DefaultComponent }), "Missing");

		const node = await render(
			React.createElement(Suspense, { fallback: React.createElement("span", null, "Загрузка") }, React.createElement(LazyDemo))
		);

		expect(node.textContent).toBe("Default");
	});
});
