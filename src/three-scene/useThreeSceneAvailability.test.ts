// @vitest-environment jsdom

import { act, createElement } from "react";

import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThreeSceneAvailability, type UseThreeSceneAvailabilityOptions } from "./index";

const disabledStorageKey = "test:three-scene:disabled";
const otherStorageKey = "test:other-three-scene:disabled";

function Probe(options: UseThreeSceneAvailabilityOptions) {
	const { status, reason } = useThreeSceneAvailability(options);
	return createElement("output", null, reason ?? status);
}

describe("useThreeSceneAvailability", () => {
	let container: HTMLDivElement;
	let root: Root | undefined;
	let prefersReducedMotion: boolean;
	let motionPreference: EventTarget;

	beforeEach(() => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		container = document.createElement("div");
		prefersReducedMotion = false;
		motionPreference = new EventTarget();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				get matches() {
					return prefersReducedMotion;
				},
				addEventListener: motionPreference.addEventListener.bind(motionPreference),
				removeEventListener: motionPreference.removeEventListener.bind(motionPreference)
			}))
		);
	});

	afterEach(async () => {
		await act(async () => root?.unmount());
		root = undefined;
		sessionStorage.clear();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	async function render(options: UseThreeSceneAvailabilityOptions) {
		const target = (root ??= createRoot(container));
		await act(async () => target.render(createElement(Probe, options)));
	}

	it("сохраняет fallback при SSR и проверяет WebGL после hydration", async () => {
		const loseContext = vi.fn();
		const context = { getExtension: () => ({ loseContext }) } as unknown as WebGL2RenderingContext;
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
		const probe = createElement(Probe, { disabledStorageKey });
		const onRecoverableError = vi.fn();

		container.innerHTML = renderToString(probe);
		expect(container.textContent).toBe("ssr");
		expect(getContext).not.toHaveBeenCalled();
		expect(sessionStorage.getItem(disabledStorageKey)).toBeNull();

		await act(async () => {
			root = hydrateRoot(container, probe, { onRecoverableError });
		});

		expect(onRecoverableError).not.toHaveBeenCalled();
		expect(container.textContent).toBe("available");
		expect(loseContext).toHaveBeenCalledTimes(1);
	});

	it("соблюдает приоритет reduced motion и пересчитывает результат после смены системной настройки", async () => {
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		prefersReducedMotion = true;
		sessionStorage.setItem(disabledStorageKey, "1");

		await render({ disabledStorageKey, disableWhenReducedMotion: true });
		expect(container.textContent).toBe("reducedMotion");

		prefersReducedMotion = false;
		await act(async () => motionPreference.dispatchEvent(new Event("change")));
		expect(container.textContent).toBe("sessionDisabled");
		expect(getContext).not.toHaveBeenCalled();
	});

	it("запоминает отказ WebGL для текущего ключа и проверяет доступность после смены ключа", async () => {
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

		await render({ disabledStorageKey });
		expect(container.textContent).toBe("webglUnsupported");
		expect(sessionStorage.getItem(disabledStorageKey)).toBe("1");
		expect(getContext).toHaveBeenCalledTimes(1);

		const context = { getExtension: () => null } as unknown as WebGLRenderingContext;
		getContext.mockReturnValue(context);
		await render({ disabledStorageKey: otherStorageKey, webGLVersion: "webgl" });
		expect(container.textContent).toBe("available");
		expect(getContext).toHaveBeenCalledTimes(2);

		await render({ disabledStorageKey });
		expect(container.textContent).toBe("sessionDisabled");
		expect(getContext).toHaveBeenCalledTimes(2);
	});
});
