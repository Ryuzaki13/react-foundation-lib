import { describe, expect, it } from "vitest";

import { closeMenu, initialMenuState, openMenu, toggleMenu } from "./state";

describe("context-menu/state", () => {
	it("openMenu открывает меню и сохраняет источник с якорем", () => {
		const anchorElement = {} as HTMLElement;
		const state = openMenu({
			source: "click",
			anchor: {
				type: "element",
				element: anchorElement
			}
		});

		expect(state).toEqual({
			open: true,
			source: "click",
			anchor: {
				type: "element",
				element: anchorElement
			}
		});
	});

	it("closeMenu возвращает исходный объект, если меню уже закрыто", () => {
		const next = closeMenu(initialMenuState);
		expect(next).toBe(initialMenuState);
	});

	it("closeMenu очищает состояние открытого меню", () => {
		const opened = openMenu({
			source: "contextmenu",
			anchor: {
				type: "point",
				point: { x: 40, y: 50 }
			}
		});

		expect(closeMenu(opened)).toEqual(initialMenuState);
	});

	it("toggleMenu закрывает открытое меню", () => {
		const opened = openMenu({
			source: "contextmenu",
			anchor: {
				type: "point",
				point: { x: 10, y: 15 }
			}
		});

		const next = toggleMenu(opened, {
			source: "click",
			anchor: {
				type: "element",
				element: {} as HTMLElement
			}
		});

		expect(next).toEqual(initialMenuState);
	});

	it("toggleMenu открывает закрытое меню", () => {
		const anchorElement = {} as HTMLElement;
		const next = toggleMenu(initialMenuState, {
			source: "keyboard",
			anchor: {
				type: "element",
				element: anchorElement
			}
		});

		expect(next).toEqual({
			open: true,
			source: "keyboard",
			anchor: {
				type: "element",
				element: anchorElement
			}
		});
	});
});
