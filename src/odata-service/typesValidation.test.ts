import { describe, expect, it } from "vitest";

import { isODataBooleanType, isODataDateType, isODataIntegerType, isODataNumericType } from "./typesValidation";

describe("odata-service type validation", () => {
	it("классифицирует ODataMetaType по доменным группам", () => {
		expect(isODataBooleanType("boolean")).toBe(true);
		expect(isODataBooleanType("string")).toBe(false);

		expect(isODataNumericType("decimal")).toBe(true);
		expect(isODataNumericType("datetime")).toBe(false);

		expect(isODataIntegerType("long")).toBe(true);
		expect(isODataIntegerType("double")).toBe(false);

		expect(isODataDateType("datetimeOffset")).toBe(true);
		expect(isODataDateType("guid")).toBe(false);
	});

	it("безопасно обрабатывает пустой тип", () => {
		expect(isODataBooleanType(undefined)).toBe(false);
		expect(isODataNumericType(undefined)).toBe(false);
		expect(isODataIntegerType(undefined)).toBe(false);
		expect(isODataDateType(undefined)).toBe(false);
	});
});
