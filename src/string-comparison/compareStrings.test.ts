import { describe, expect, it } from "vitest";

import { compareStrings } from "./compareStrings";

describe("compareStrings", () => {
	it("стабильно сортирует смешанную кириллицу и латиницу", () => {
		expect(["TEXT_CODE", "Технический ID", "Название"].sort(compareStrings)).toEqual(["Название", "Технический ID", "TEXT_CODE"]);
	});

	it("сортирует числовые суффиксы как числа", () => {
		expect(["item10", "item2", "item1"].sort(compareStrings)).toEqual(["item1", "item2", "item10"]);
	});

	it("использует детерминированный fallback для строк, равных по base-collation", () => {
		expect(["a", "A"].sort(compareStrings)).toEqual(["A", "a"]);
	});
});
