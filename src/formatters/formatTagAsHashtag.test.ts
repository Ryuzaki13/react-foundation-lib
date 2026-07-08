import { describe, expect, it } from "vitest";

import { formatTagAsHashtag } from "./formatTagAsHashtag";

describe("formatTagAsHashtag", () => {
	it("добавляет # и убирает внутренние пробелы", () => {
		expect(formatTagAsHashtag("React")).toBe("#React");
		expect(formatTagAsHashtag(" machine learning ")).toBe("#machinelearning");
	});

	it("не дублирует ведущую решетку", () => {
		expect(formatTagAsHashtag("#frontend")).toBe("#frontend");
		expect(formatTagAsHashtag("###design system")).toBe("#designsystem");
	});
});
