import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
});

it("SSR opt-out не меняет общий process state и сохраняет SSR capture result", async () => {
	vi.resetModules();
	const getItem = vi.fn(() => null);
	vi.stubGlobal("sessionStorage", { getItem });
	const api = await import("./index");
	api.disableErrorReportBrowserStorage();
	expect(getItem).not.toHaveBeenCalled();
	await expect(api.captureRuntimeErrorReport(new Error("SSR"))).resolves.toBeUndefined();

	// Тот же module instance после SSR no-op остаётся в обычном режиме.
	vi.stubGlobal("window", {});
	expect(api.getErrorReportDrafts()).toEqual([]);
	expect(getItem).toHaveBeenCalledOnce();
});
