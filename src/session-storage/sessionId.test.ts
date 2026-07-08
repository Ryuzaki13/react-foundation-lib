// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { getSessionStorageId } from "./sessionId";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	sessionStorage.clear();
});

describe("getSessionStorageId", () => {
	it("создает id один раз и переиспользует значение из sessionStorage", () => {
		const createId = vi.fn(() => "session-1");

		expect(getSessionStorageId("arm.session", createId)).toBe("session-1");
		expect(getSessionStorageId("arm.session", () => "session-2")).toBe("session-1");
		expect(createId).toHaveBeenCalledOnce();
	});

	it("создает новый id, если sessionStorage недоступен", () => {
		vi.stubGlobal("sessionStorage", undefined);

		expect(getSessionStorageId("arm.session", () => "fallback")).toBe("fallback");
	});

	it("создает fallback id при ошибке чтения или записи", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});

		expect(getSessionStorageId("arm.session", () => "safe")).toBe("safe");
	});
});
