import { describe, expect, it } from "vitest";

import { BASE_META_TYPES, isBaseMetaType, resolveBaseTypeLabel } from "./baseTypes";

describe("odata-service base types", () => {
	it("экспортирует единый справочник базовых типов UI", () => {
		expect(BASE_META_TYPES).toEqual(["string", "number", "boolean", "date"]);
		expect(isBaseMetaType("string")).toBe(true);
		expect(isBaseMetaType("datetime")).toBe(false);
	});

	it("возвращает подписи базовых типов", () => {
		expect(resolveBaseTypeLabel("string")).toBe("строка");
		expect(resolveBaseTypeLabel("number")).toBe("число");
		expect(resolveBaseTypeLabel("boolean")).toBe("boolean");
		expect(resolveBaseTypeLabel("date")).toBe("дата");
	});
});
