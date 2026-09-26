// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { captureScrollAnchor } from "../index";

/** JSDOM не вычисляет layout: геометрия зависит от scrollTop, как у обычного вертикального scroll host. */
function createScrollFixture() {
	const viewport = document.createElement("div");
	const anchor = document.createElement("p");
	viewport.append(anchor);
	document.body.append(viewport);
	viewport.scrollTop = 150;
	viewport.scrollLeft = 7;
	Object.defineProperty(viewport, "clientTop", { configurable: true, value: 2 });
	const layout = { viewportTop: 100, anchorContentTop: 200 };
	vi.spyOn(viewport, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, layout.viewportTop, 300, 400));
	vi.spyOn(anchor, "getBoundingClientRect").mockImplementation(
		() => new DOMRect(0, layout.viewportTop + viewport.clientTop + layout.anchorContentTop - viewport.scrollTop, 200, 30)
	);
	const scrollBy = vi.fn((options: ScrollToOptions) => {
		viewport.scrollTop += options.top ?? 0;
		viewport.scrollLeft += options.left ?? 0;
	});
	Object.defineProperty(viewport, "scrollBy", { configurable: true, value: scrollBy });
	return { viewport, anchor, layout, scrollBy };
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("captureScrollAnchor", () => {
	it("компенсирует prepend мгновенно и сохраняет горизонтальную позицию", () => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		viewport.style.setProperty("scroll-behavior", "smooth");
		const before = anchor.getBoundingClientRect().top;
		const operation = captureScrollAnchor(viewport, anchor);
		expect(operation).not.toBeNull();
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("none");
		expect(viewport.style.getPropertyPriority("overflow-anchor")).toBe("important");

		layout.anchorContentTop += 80;
		expect(operation?.restore()).toBe(true);
		expect(anchor.getBoundingClientRect().top).toBe(before);
		expect(viewport.scrollTop).toBe(230);
		expect(viewport.scrollLeft).toBe(7);
		expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 80, behavior: "instant" });
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("");
		expect(viewport.style.getPropertyValue("scroll-behavior")).toBe("smooth");
	});

	it.each([65, -25])("сохраняет ручную прокрутку %s во время ожидания", (userScroll) => {
		const { viewport, anchor, layout } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		viewport.scrollTop += userScroll;
		const beforePrepend = anchor.getBoundingClientRect().top;
		layout.anchorContentTop += 90;

		expect(operation?.restore()).toBe(true);
		expect(viewport.scrollTop).toBe(150 + userScroll + 90);
		expect(anchor.getBoundingClientRect().top).toBe(beforePrepend);
	});

	it("не компенсирует перемещение самого viewport и изменение его рамки", () => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		layout.viewportTop -= 42;
		Object.defineProperty(viewport, "clientTop", { value: 4 });

		expect(operation?.restore()).toBe(true);
		expect(scrollBy).not.toHaveBeenCalled();
		expect(viewport.scrollTop).toBe(150);
	});

	it.each([0, -15.5, 32.25])("применяет только content delta %s, не округляет и не пишет при нуле", (delta) => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += delta;

		expect(operation?.restore()).toBe(true);
		expect(viewport.scrollTop).toBe(150 + delta);
		expect(scrollBy).toHaveBeenCalledTimes(delta === 0 ? 0 : 1);
	});

	it("release отменяет компенсацию, а завершение остаётся одноразовым", () => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += 80;
		operation?.release();
		operation?.release();

		expect(operation?.restore()).toBe(false);
		expect(scrollBy).not.toHaveBeenCalled();
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("");
		const next = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += 20;
		expect(next?.restore()).toBe(true);
		expect(next?.restore()).toBe(false);
		next?.release();
		expect(scrollBy).toHaveBeenCalledOnce();
	});

	it.each(["", "important"])("восстанавливает исходные значение и CSS priority=%s", (priority) => {
		const { viewport, anchor } = createScrollFixture();
		viewport.style.setProperty("overflow-anchor", "auto", priority);
		const operation = captureScrollAnchor(viewport, anchor);
		operation?.release();

		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("auto");
		expect(viewport.style.getPropertyPriority("overflow-anchor")).toBe(priority);
	});

	it("внешнее изменение overflow-anchor отменяет компенсацию и не перезаписывается", () => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		viewport.style.setProperty("overflow-anchor", "auto", "important");
		layout.anchorContentTop += 80;
		expect(operation?.restore()).toBe(false);
		operation?.release();

		expect(scrollBy).not.toHaveBeenCalled();
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("auto");
		expect(viewport.style.getPropertyPriority("overflow-anchor")).toBe("important");
	});

	it("компенсирует и без поддержки native overflow-anchor браузером", () => {
		const { viewport, anchor, layout } = createScrollFixture();
		vi.spyOn(viewport.style, "setProperty").mockImplementation(() => undefined);
		const operation = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += 80;

		expect(operation?.restore()).toBe(true);
		expect(viewport.scrollTop).toBe(230);
	});

	it("новый capture отменяет старый без двойного сдвига и утечки native anchoring", () => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const previous = captureScrollAnchor(viewport, anchor);
		const current = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += 80;

		previous?.release();
		expect(previous?.restore()).toBe(false);
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("none");
		expect(current?.restore()).toBe(true);
		previous?.release();
		expect(scrollBy).toHaveBeenCalledOnce();
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("");
	});

	it("разные scroll host имеют независимый lifecycle", () => {
		const first = createScrollFixture();
		const second = createScrollFixture();
		const a = captureScrollAnchor(first.viewport, first.anchor);
		const b = captureScrollAnchor(second.viewport, second.anchor);
		first.layout.anchorContentTop += 20;
		second.layout.anchorContentTop += 70;

		expect(a?.restore()).toBe(true);
		expect(second.viewport.style.getPropertyValue("overflow-anchor")).toBe("none");
		expect(b?.restore()).toBe(true);
		expect(first.viewport.scrollTop).toBe(170);
		expect(second.viewport.scrollTop).toBe(220);
	});

	it("отказывает null, самому viewport, чужому и отключённому anchor без изменения стиля", () => {
		const { viewport, anchor } = createScrollFixture();
		const unrelated = document.createElement("div");
		document.body.append(unrelated);
		expect(captureScrollAnchor(null, anchor)).toBeNull();
		expect(captureScrollAnchor(viewport, null)).toBeNull();
		expect(captureScrollAnchor(viewport, viewport)).toBeNull();
		expect(captureScrollAnchor(viewport, unrelated)).toBeNull();
		anchor.remove();
		expect(captureScrollAnchor(viewport, anchor)).toBeNull();
		viewport.append(anchor);
		viewport.remove();
		expect(captureScrollAnchor(viewport, anchor)).toBeNull();
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("");
	});

	it.each(["viewport", "anchor", "reparent"])("не прокручивает устаревший DOM: %s", (change) => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += 80;
		if (change === "viewport") viewport.remove();
		else if (change === "anchor") anchor.remove();
		else document.body.append(anchor);

		expect(operation?.restore()).toBe(false);
		expect(scrollBy).not.toHaveBeenCalled();
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("");
	});

	it("освобождает capture даже при ошибке browser scroll API", () => {
		const { viewport, anchor, layout, scrollBy } = createScrollFixture();
		const operation = captureScrollAnchor(viewport, anchor);
		layout.anchorContentTop += 80;
		scrollBy.mockImplementation(() => {
			throw new Error("scroll failure");
		});

		expect(() => operation?.restore()).toThrow("scroll failure");
		expect(viewport.style.getPropertyValue("overflow-anchor")).toBe("");
		expect(operation?.restore()).toBe(false);
	});
});
