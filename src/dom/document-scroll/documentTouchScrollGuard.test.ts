// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquireDocumentScrollLock } from "./acquireDocumentScrollLock";

type TouchPoint = Readonly<{ identifier: number; clientX: number; clientY: number }>;
type TouchEventOptions = Readonly<{ cancelable?: boolean }>;
type ScrollGeometry = Readonly<{ top?: number; height?: number; viewport?: number }>;

const releases: Array<() => void> = [];

beforeEach(() => {
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
	for (const release of releases.splice(0)) release();
	document.getSelection()?.removeAllRanges();
	document.body.replaceChildren();
	document.body.removeAttribute("style");
	document.documentElement.removeAttribute("style");
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function lockDocument(): () => void {
	const release = acquireDocumentScrollLock(document, false);
	releases.push(release);
	return release;
}

function point(y = 100, x = 100, identifier = 1): TouchPoint {
	return { identifier, clientX: x, clientY: y };
}

/** JSDOM не создаёт аппаратный Touch; observable contract проверяется через обычную DOM-доставку. */
function touch(target: EventTarget, type: string, points: readonly TouchPoint[], options: TouchEventOptions = {}): Event {
	const event = new Event(type, { bubbles: true, composed: true, cancelable: options.cancelable ?? true });
	const touches = Object.assign([...points], { item: (index: number) => points[index] ?? null });
	Object.defineProperty(event, "touches", { value: touches });
	target.dispatchEvent(event);
	return event;
}

function element(tag = "div", parent: Node = document.body): HTMLElement {
	return parent.appendChild(document.createElement(tag));
}

function scrollArea(parent: Node = document.body, { top = 100, height = 400, viewport = 100 }: ScrollGeometry = {}): HTMLElement {
	const area = element("div", parent);
	area.style.overflowY = "auto";
	Object.defineProperties(area, {
		scrollHeight: { configurable: true, value: height },
		clientHeight: { configurable: true, value: viewport },
		scrollTop: { configurable: true, writable: true, value: top }
	});
	return area;
}

function verticalGesture(target: EventTarget, delta = 20): Event {
	touch(target, "touchstart", [point()]);
	const event = touch(target, "touchmove", [point(100 - delta)]);
	touch(target, "touchend", []);
	return event;
}

function selectContents(target: Node): void {
	const range = document.createRange();
	range.selectNodeContents(target);
	const selection = document.getSelection();
	if (!selection) throw new Error("Нет Selection в тестовом документе");
	selection.removeAllRanges();
	selection.addRange(range);
}

describe("вертикальная touch-граница общей блокировки документа", () => {
	it.each([-20, 20])("останавливает pan заголовка по направлению %s, сохраняя touchstart и tap", (delta) => {
		const header = element("header");
		lockDocument();
		const start = touch(header, "touchstart", [point()]);
		expect(start.defaultPrevented).toBe(false);
		expect(touch(header, "touchmove", [point(100 - delta)]).defaultPrevented).toBe(true);
		expect(touch(header, "touchend", []).defaultPrevented).toBe(false);
	});

	it.each([
		{ top: 100, delta: 20, blocked: false },
		{ top: 100, delta: -20, blocked: false },
		{ top: 0, delta: -20, blocked: true },
		{ top: 0, delta: 20, blocked: false },
		{ top: 300, delta: 20, blocked: true },
		{ top: 300, delta: -20, blocked: false },
		{ top: -15, delta: -20, blocked: true },
		{ top: -15, delta: 20, blocked: false },
		{ top: 315, delta: 20, blocked: true },
		{ top: 315, delta: -20, blocked: false },
		{ top: 0.5, delta: -20, blocked: true },
		{ top: 299.5, delta: 20, blocked: true },
		{ top: 1, delta: -20, blocked: true },
		{ top: 299, delta: 20, blocked: true },
		{ top: 1.01, delta: -20, blocked: false },
		{ top: 298.99, delta: 20, blocked: false }
	])("учитывает позицию $top и направление $delta без ручного изменения scrollTop", ({ top, delta, blocked }) => {
		const area = scrollArea(document.body, { top });
		const target = element("span", area);
		lockDocument();
		expect(verticalGesture(target, delta).defaultPrevented).toBe(blocked);
		expect(area.scrollTop).toBe(top);
	});

	it.each(["auto", "contain", "none"])("соблюдает nested scroll chain при overscroll %s", (overscroll) => {
		const outer = scrollArea();
		const inner = scrollArea(outer, { top: 300 });
		inner.style.overscrollBehaviorY = overscroll;
		lockDocument();
		expect(verticalGesture(element("span", inner)).defaultPrevented).toBe(overscroll !== "auto");
	});

	it.each(["contain", "none"])("не отменяет обычное внутреннее движение до края при %s", (overscroll) => {
		const inner = scrollArea();
		inner.style.overscrollBehaviorY = overscroll;
		lockDocument();
		expect(verticalGesture(inner).defaultPrevented).toBe(false);
	});

	it.each([-20, 20])("останавливает pan короткого scroll-контента в направлении %s", (delta) => {
		const area = scrollArea(document.body, { top: 0, height: 60, viewport: 100 });
		lockDocument();
		expect(verticalGesture(area, delta).defaultPrevented).toBe(true);
	});

	it.each(["auto", "contain"])("короткая nested область соблюдает границу %s", (overscroll) => {
		const outer = scrollArea();
		const short = scrollArea(outer, { top: 0, height: 60, viewport: 100 });
		short.style.overscrollBehaviorY = overscroll;
		lockDocument();
		expect(verticalGesture(short).defaultPrevented).toBe(overscroll === "contain");
	});

	it("не принимает scrollable body/html за разрешённую внутреннюю область", () => {
		lockDocument();
		expect(verticalGesture(document.body).defaultPrevented).toBe(true);
		expect(verticalGesture(document.documentElement).defaultPrevented).toBe(true);
	});

	it.each(["hidden", "clip", "visible"])("не считает overflow %s пользовательским scroll-host", (overflow) => {
		const area = scrollArea();
		area.style.overflowY = overflow;
		lockDocument();
		expect(verticalGesture(area).defaultPrevented).toBe(true);
	});

	it.each([
		{ x: 60, y: 100 },
		{ x: 140, y: 100 },
		{ x: 60, y: 80 },
		{ x: 120, y: 80 },
		{ x: 100, y: 100 }
	])("не отменяет горизонтальное, равнодиагональное или нулевое движение $x/$y", ({ x, y }) => {
		const header = element("header");
		lockDocument();
		touch(header, "touchstart", [point()]);
		expect(touch(header, "touchmove", [point(y, x)]).defaultPrevented).toBe(false);
	});

	it.each(["column-reverse", "vertical-rl", "vertical-lr"])("не навязывает обычную координатную модель %s", (layout) => {
		const area = scrollArea(document.body, { top: 0 });
		if (layout === "column-reverse") area.style.flexDirection = layout;
		else area.style.writingMode = layout;
		lockDocument();
		expect(verticalGesture(area, -20).defaultPrevented).toBe(false);
	});

	it("проверяет актуальную позицию и направление при последующих touchmove", () => {
		const area = scrollArea();
		lockDocument();
		touch(area, "touchstart", [point()]);
		expect(touch(area, "touchmove", [point(80)]).defaultPrevented).toBe(false);
		area.scrollTop = 300;
		expect(touch(area, "touchmove", [point(60)]).defaultPrevented).toBe(true);
		expect(touch(area, "touchmove", [point(70)]).defaultPrevented).toBe(false);
	});

	it("не принимает прежнюю геометрию удалённого scroll-host за разрешение прокрутки", () => {
		const area = scrollArea();
		const target = element("span", area);
		lockDocument();
		touch(target, "touchstart", [point()]);
		area.remove();
		expect(touch(document, "touchmove", [point(80)]).defaultPrevented).toBe(true);
	});
});

describe("сохранение нативного редактирования и выделения", () => {
	it.each(["input", "textarea", "select", "range", "audio", "video"])("пропускает собственный touch-сценарий %s", (kind) => {
		const control = element(kind === "range" ? "input" : kind);
		if (kind === "range") control.setAttribute("type", "range");
		if (kind === "audio" || kind === "video") control.setAttribute("controls", "");
		lockDocument();
		expect(verticalGesture(control).defaultPrevented).toBe(false);
	});

	it.each(["input", "textarea", "select"])("disabled %s не отключает защиту фона", (kind) => {
		const control = element(kind);
		control.setAttribute("disabled", "");
		lockDocument();
		expect(verticalGesture(control).defaultPrevented).toBe(true);
	});

	it("учитывает disabled от fieldset, но сохраняет нативный сценарий readonly input", () => {
		const fieldset = element("fieldset");
		fieldset.setAttribute("disabled", "");
		const disabledInput = element("input", fieldset);
		const readonlyInput = element("input");
		readonlyInput.setAttribute("readonly", "");
		lockDocument();
		expect(verticalGesture(disabledInput).defaultPrevented).toBe(true);
		expect(verticalGesture(readonlyInput).defaultPrevented).toBe(false);
	});

	it.each(["", "true", "TRUE", "plaintext-only"])("распознаёт editable %s из дочернего узла", (editable) => {
		const editor = element();
		editor.setAttribute("contenteditable", editable);
		lockDocument();
		expect(verticalGesture(element("span", editor)).defaultPrevented).toBe(false);
	});

	it("contenteditable=false останавливает наследование editable, не мешая новому вложенному editor", () => {
		const editor = element();
		editor.setAttribute("contenteditable", "true");
		const readonly = element("div", editor);
		readonly.setAttribute("contenteditable", "false");
		const nestedEditor = element("div", readonly);
		nestedEditor.setAttribute("contenteditable", "true");
		lockDocument();
		expect(verticalGesture(readonly).defaultPrevented).toBe(true);
		expect(verticalGesture(nestedEditor).defaultPrevented).toBe(false);
	});

	it("сохраняет выделение в target, но чужое выделение не разрешает pan заголовка", () => {
		const paragraph = element("p");
		paragraph.textContent = "Текст для выделения";
		const header = element("header");
		selectContents(paragraph);
		lockDocument();
		expect(verticalGesture(paragraph).defaultPrevented).toBe(false);
		expect(verticalGesture(header).defaultPrevented).toBe(true);
	});

	it("сохраняет частичное выделение текста внутри target", () => {
		const paragraph = element("p");
		const text = paragraph.appendChild(document.createTextNode("Текст для выделения"));
		const selection = document.getSelection();
		if (!selection) throw new Error("Нет Selection в тестовом документе");
		const range = document.createRange();
		range.setStart(text, 2);
		range.setEnd(text, 6);
		selection.addRange(range);
		lockDocument();
		expect(verticalGesture(paragraph).defaultPrevented).toBe(false);
	});

	it("учитывает появившееся после touchstart выделение и не перехватывает остаток этого жеста", () => {
		const paragraph = element("p");
		paragraph.textContent = "Текст для выделения";
		lockDocument();
		touch(paragraph, "touchstart", [point()]);
		selectContents(paragraph);
		expect(touch(paragraph, "touchmove", [point(80)]).defaultPrevented).toBe(false);
		document.getSelection()?.removeAllRanges();
		expect(touch(paragraph, "touchmove", [point(60)]).defaultPrevented).toBe(false);
	});
});

describe("touch lifecycle, zoom и native boundary", () => {
	it.each(["touchend", "touchcancel"])("pinch остаётся нативным до завершения всех касаний через %s", (ending) => {
		const target = element("header");
		lockDocument();
		touch(target, "touchstart", [point()]);
		touch(target, "touchstart", [point(), point(100, 140, 2)]);
		expect(touch(target, "touchmove", [point(80), point(80, 140, 2)]).defaultPrevented).toBe(false);
		touch(target, ending, [point(80)]);
		expect(touch(target, "touchmove", [point(60)]).defaultPrevented).toBe(false);
		touch(target, ending, []);
		expect(verticalGesture(target).defaultPrevented).toBe(true);
	});

	it("multi-touch обнаруженный на touchmove также отключает перехват до полного отпускания", () => {
		const target = element("header");
		lockDocument();
		touch(target, "touchstart", [point()]);
		expect(touch(target, "touchmove", [point(80), point(80, 140, 2)]).defaultPrevented).toBe(false);
		touch(target, "touchend", [point(80)]);
		expect(touch(target, "touchmove", [point(60)]).defaultPrevented).toBe(false);
	});

	it("не перехватывает pan после zoom и возвращает защиту только на новом обычном жесте", () => {
		const viewport = { scale: 2 };
		vi.stubGlobal("visualViewport", viewport);
		const target = element("header");
		lockDocument();
		touch(target, "touchstart", [point()]);
		expect(touch(target, "touchmove", [point(80)]).defaultPrevented).toBe(false);
		viewport.scale = 1;
		expect(touch(target, "touchmove", [point(60)]).defaultPrevented).toBe(false);
		touch(target, "touchend", []);
		expect(verticalGesture(target).defaultPrevented).toBe(true);
	});

	it("учитывает zoom, возникший после touchstart", () => {
		const viewport = { scale: 1 };
		vi.stubGlobal("visualViewport", viewport);
		const target = element("header");
		lockDocument();
		touch(target, "touchstart", [point()]);
		viewport.scale = 2;
		expect(touch(target, "touchmove", [point(80)]).defaultPrevented).toBe(false);
	});

	it("не подменяет касание при изменившемся identifier", () => {
		const target = element("header");
		lockDocument();
		touch(target, "touchstart", [point()]);
		expect(touch(target, "touchmove", [point(80, 100, 2)]).defaultPrevented).toBe(false);
		expect(touch(target, "touchmove", [point(60)]).defaultPrevented).toBe(false);
		touch(target, "touchend", []);
		expect(verticalGesture(target).defaultPrevented).toBe(true);
	});

	it("не отменяет событие без начала, noncancelable или уже отменённое другим владельцем", () => {
		const target = element("header");
		lockDocument();
		expect(touch(target, "touchmove", [point(80)]).defaultPrevented).toBe(false);
		touch(target, "touchstart", [point()]);
		expect(touch(target, "touchmove", [point(80)], { cancelable: false }).defaultPrevented).toBe(false);
		const prevented = new Event("touchmove", { bubbles: true, composed: true, cancelable: true });
		Object.defineProperty(prevented, "touches", { value: [point(60)] });
		prevented.preventDefault();
		const preventDefault = vi.spyOn(prevented, "preventDefault");
		target.dispatchEvent(prevented);
		expect(preventDefault).not.toHaveBeenCalled();
	});

	it("не перехватывает wheel и не останавливает доставку touchmove другим владельцам", () => {
		const target = element("header");
		const moved = vi.fn((event: Event) => event.defaultPrevented);
		target.addEventListener("touchmove", moved);
		lockDocument();
		const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 20 });
		target.dispatchEvent(wheel);
		expect(wheel.defaultPrevented).toBe(false);
		expect(verticalGesture(target).defaultPrevented).toBe(true);
		expect(moved).toHaveBeenCalledOnce();
		expect(moved).toHaveReturnedWith(true);
	});

	it("видит scroll-host в open shadow DOM через composed path", () => {
		const host = element();
		const shadow = host.attachShadow({ mode: "open" });
		const area = scrollArea(shadow);
		const target = element("span", area);
		lockDocument();
		expect(verticalGesture(target).defaultPrevented).toBe(false);
		area.scrollTop = 300;
		expect(verticalGesture(target).defaultPrevented).toBe(true);
	});

	it("видит нативный control в open shadow DOM", () => {
		const shadow = element().attachShadow({ mode: "open" });
		const input = element("input", shadow);
		lockDocument();
		expect(verticalGesture(input).defaultPrevented).toBe(false);
	});

	it("разделяет listeners между leases, снимает их последним cleanup и возобновляет защиту", () => {
		const target = element("header");
		const added = vi.spyOn(document, "addEventListener");
		const removed = vi.spyOn(document, "removeEventListener");
		const first = lockDocument();
		const second = lockDocument();
		for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
			expect(added.mock.calls.filter(([name]) => name === type)).toHaveLength(1);
		}
		first();
		expect(verticalGesture(target).defaultPrevented).toBe(true);
		// Последний cleanup должен удалить и состояние прерванного pinch.
		touch(target, "touchstart", [point(), point(100, 140, 2)]);
		second();
		for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
			expect(removed.mock.calls.filter(([name]) => name === type)).toHaveLength(1);
		}
		expect(verticalGesture(target).defaultPrevented).toBe(false);
		lockDocument();
		expect(verticalGesture(target).defaultPrevented).toBe(true);
	});
});
