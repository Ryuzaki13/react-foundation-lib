import { describe, expect, it } from "vitest";

import { createMissingContextError, createMissingContextErrorMessage } from "./missingContextError";

describe("missingContextError", () => {
	it("строит сообщение без имени context", () => {
		expect(createMissingContextErrorMessage({ hookName: "useDemo", providerName: "DemoProvider" })).toContain(
			"Хук useDemo должен использоваться внутри DemoProvider."
		);
	});

	it("добавляет имя context и возвращает Error с тем же сообщением", () => {
		const message = createMissingContextErrorMessage({
			hookName: "useDemo",
			providerName: "DemoProvider",
			contextName: "DemoContext"
		});

		expect(message).toContain('Контекст "DemoContext" равен null');
		expect(createMissingContextError({ hookName: "useDemo", providerName: "DemoProvider", contextName: "DemoContext" }).message).toBe(
			message
		);
	});
});
