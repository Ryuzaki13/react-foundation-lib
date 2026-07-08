import { describe, expect, it } from "vitest";

import { createVirtualAnchor, getMenuPointFromEvent, getMenuPointFromRect } from "./anchor";

describe("context-menu/anchor", () => {
	it("getMenuPointFromEvent возвращает clientX/clientY", () => {
		expect(getMenuPointFromEvent({ clientX: 120, clientY: 240 })).toEqual({ x: 120, y: 240 });
	});

	it("getMenuPointFromRect возвращает геометрический центр", () => {
		expect(getMenuPointFromRect({ left: 10, top: 20, width: 80, height: 40 })).toEqual({ x: 50, y: 40 });
	});

	it("createVirtualAnchor формирует virtual element для floating-ui", () => {
		const element = {} as Element;
		const virtualAnchor = createVirtualAnchor({ x: 11, y: 22 }, element);

		expect(virtualAnchor.contextElement).toBe(element);
		expect(virtualAnchor.getBoundingClientRect()).toEqual({
			x: 11,
			y: 22,
			top: 22,
			left: 11,
			bottom: 22,
			right: 11,
			width: 0,
			height: 0,
			toJSON: expect.any(Function)
		});
	});
});
