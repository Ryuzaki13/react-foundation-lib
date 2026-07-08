import { describe, expect, it } from "vitest";

import { resolveValueStateClassName } from "./resolveValueStateClassName";

describe("resolveValueStateClassName", () => {
	it("возвращает CSS class для известных semantic states", () => {
		expect(resolveValueStateClassName("success")).toBe("statusSuccess");
		expect(resolveValueStateClassName("warning")).toBe("statusWarning");
		expect(resolveValueStateClassName("error")).toBe("statusError");
		expect(resolveValueStateClassName("information")).toBe("statusInfo");
	});

	it("возвращает fallback для none и пустого состояния", () => {
		expect(resolveValueStateClassName("none", "fallback")).toBe("fallback");
		expect(resolveValueStateClassName("", "fallback")).toBe("fallback");
		expect(resolveValueStateClassName("none")).toBeUndefined();
	});
});
