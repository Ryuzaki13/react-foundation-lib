// @vitest-environment jsdom

import { act, createElement } from "react";

import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const floatingMocks = vi.hoisted(() => ({
	autoPlacement: vi.fn((options: unknown) => ({ name: "autoPlacement", options })),
	flip: vi.fn((options: unknown) => ({ name: "flip", options })),
	size: vi.fn((options: unknown) => ({ name: "size", options })),
	update: vi.fn(async () => undefined)
}));

vi.mock("@floating-ui/react", () => ({
	autoPlacement: floatingMocks.autoPlacement,
	autoUpdate: vi.fn(),
	flip: floatingMocks.flip,
	offset: vi.fn((options: unknown) => ({ name: "offset", options })),
	shift: vi.fn((options: unknown) => ({ name: "shift", options })),
	size: floatingMocks.size,
	useDismiss: vi.fn(() => ({})),
	useFloating: vi.fn(() => ({
		refs: {
			floating: { current: null },
			domReference: { current: null },
			setReference: vi.fn(),
			setFloating: vi.fn()
		},
		floatingStyles: {},
		context: {},
		update: floatingMocks.update
	})),
	useInteractions: vi.fn(() => ({ getFloatingProps: vi.fn(() => ({})) })),
	useRole: vi.fn(() => ({}))
}));

import { type FloatingListboxPlacementStrategy, useFloatingListbox } from "./useFloatingListbox";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ options, placementStrategy }: { options: readonly number[]; placementStrategy?: FloatingListboxPlacementStrategy }) {
	useFloatingListbox({
		options,
		selectedIndex: -1,
		open: true,
		focusFloatingOnOpen: false,
		placementStrategy,
		resolveFloatingSize: () => ({ "--test-option-count": String(options.length) })
	});

	return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderHarness(options: readonly number[], placementStrategy?: FloatingListboxPlacementStrategy) {
	if (!container) {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	}

	await act(async () => root?.render(createElement(Harness, { options, placementStrategy })));
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(async () => {
	if (root) {
		await act(async () => root?.unmount());
	}

	container?.remove();
	container = null;
	root = null;
});

describe("useFloatingListbox", () => {
	it("проверяет вертикальные и горизонтальные стороны в auto-режиме", async () => {
		await renderHarness([], "auto");

		expect(floatingMocks.autoPlacement).toHaveBeenCalledWith({
			allowedPlacements: ["bottom-start", "bottom-end", "top-start", "top-end", "left-start", "left-end", "right-start", "right-end"],
			crossAxis: false,
			padding: 8
		});
		expect(floatingMocks.flip).not.toHaveBeenCalled();
	});

	it("повторно запускает middleware после асинхронного изменения количества опций", async () => {
		await renderHarness([]);
		floatingMocks.update.mockClear();

		await renderHarness([1, 2, 3]);

		expect(floatingMocks.update).toHaveBeenCalledTimes(1);
	});

	it("первый size middleware читает актуальный resolver после rerender", async () => {
		await renderHarness([]);
		const initialSizeOptions = floatingMocks.size.mock.calls[0]?.[0] as {
			apply: (context: {
				availableWidth: number;
				availableHeight: number;
				rects: { reference: { width: number; height: number } };
				elements: { floating: HTMLElement };
			}) => void;
		};
		const floatingElement = document.createElement("div");
		document.body.appendChild(floatingElement);

		await renderHarness([1, 2, 3]);
		initialSizeOptions.apply({
			availableWidth: 800,
			availableHeight: 600,
			rects: { reference: { width: 240, height: 32 } },
			elements: { floating: floatingElement }
		});

		expect(floatingElement.style.getPropertyValue("--test-option-count")).toBe("3");
		floatingElement.remove();
	});
});
