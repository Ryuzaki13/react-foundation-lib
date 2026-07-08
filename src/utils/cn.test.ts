import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
	it("собирает строковые классы и пропускает пустые значения", () => {
		expect(cn("base", false, undefined, null, "", true, "extra")).toBe("base extra");
	});

	it("добавляет только truthy-модификаторы в исходном порядке", () => {
		expect(cn("base", { active: true, hidden: false, focused: true }, "tail")).toBe("base active focused tail");
	});

	it("игнорирует массивы в рантайме", () => {
		expect(cn([] as unknown as Record<string, boolean>, "tail")).toBe("tail");
	});
});
