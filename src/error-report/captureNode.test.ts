import { afterEach, describe, expect, it, vi } from "vitest";

import { captureRuntimeErrorReport } from "./capture";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("captureRuntimeErrorReport вне браузера", () => {
	it("не запускает клиентский TTL-таймер для SSR no-op capture", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

		await expect(captureRuntimeErrorReport(new Error("SSR runtime error"))).resolves.toBeUndefined();

		expect(setTimeoutSpy).not.toHaveBeenCalled();
	});
});
