import { describe, expect, it } from "vitest";

import { ODataDateFormat } from "../odata";

import {
	createBooleanFormatter,
	createDateFormatter,
	createNumberFormatter,
	createStringFormatter,
	defaultControlTypeValue,
	defaultODataTypeValue,
	getBaseTypeFromODataType,
	getFormatter,
	getFormatterForBaseType,
	getFormattersFor,
	getFormattersForBaseType,
	odataFormatValue,
	odataParseValue,
	odataParseValueByMetadata
} from "./formatters";

describe("odata formatters", () => {
	it("сериализует OData primitives с экранированием и type suffix", () => {
		expect(odataFormatValue("string", "O'Reilly")).toBe("'O''Reilly'");
		expect(odataFormatValue("guid", "550e8400-e29b-41d4-a716-446655440000")).toBe("guid'550e8400-e29b-41d4-a716-446655440000'");
		expect(odataFormatValue("boolean", true)).toBe("'X'");
		expect(odataFormatValue("boolean", false)).toBe("' '");
		expect(odataFormatValue("int", 42)).toBe("42");
		expect(odataFormatValue("byte", 255)).toBe("255");
		expect(odataFormatValue("long", 42)).toBe("42L");
		expect(odataFormatValue("float", 1.5)).toBe("1.5F");
		expect(odataFormatValue("decimal", 1.5)).toBe("1.5M");
		expect(odataFormatValue("double", 1.5)).toBe("1.5D");
		expect(odataFormatValue("binary", "AAFF")).toBe("binary'AAFF'");
	});

	it("сериализует datetime без изменения календарных компонентов", () => {
		const value = new Date(2026, 2, 10, 0, 0, 0);

		expect(odataFormatValue("datetime", value)).toBe("datetime'2026-03-10T00:00:00'");
		expect(getFormatterForBaseType("date", "base")?.fn(value)).toBe("datetime'2026-03-10T00:00:00'");
	});

	it("сериализует time без изменения календарных компонентов", () => {
		const value = new Date(2026, 2, 10, 23, 59, 59);

		expect(odataFormatValue("time", value)).toBe("time'PT23H59M59S'");
	});

	it("сохраняет datetimeoffset как ISO-строку в UTC", () => {
		const value = new Date("2026-03-10T00:00:00.000Z");

		expect(ODataDateFormat.datetimeOffset(value)).toBe("datetimeoffset'2026-03-10T00:00:00.000Z'");
	});

	it("парсит числовые OData-значения в number", () => {
		expect(odataParseValue("decimal", "10,5")).toBe(10.5);
		expect(odataParseValue("int", "42")).toBe(42);
		expect(odataParseValue("byte", "7")).toBe(7);
	});

	it("парсит boolean OData-значения из SAP и browser primitives", () => {
		expect(odataParseValue("boolean", "X")).toBe(true);
		expect(odataParseValue("boolean", " ")).toBe(false);
		expect(odataParseValue("boolean", "")).toBe(false);
		expect(odataParseValue("boolean", "true")).toBe(true);
		expect(odataParseValue("boolean", "FALSE")).toBe(false);
		expect(odataParseValue("boolean", false)).toBe(false);
		expect(odataParseValue("boolean", "0")).toBe(false);
		expect(odataParseValue("boolean", 1)).toBe(true);
		expect(odataParseValue("boolean", 2)).toBe(2);
		expect(odataParseValue("boolean", "maybe")).toBe("maybe");
	});

	it("парсит OData-дату в Date", () => {
		const parsed = odataParseValue("datetime", "/Date(1773090000000)/");

		expect(parsed).toBeInstanceOf(Date);
	});

	it("парсит boolean-like string(1) в boolean", () => {
		expect(odataParseValueByMetadata({ type: "string", abapBooleanLike: true }, "X")).toBe(true);
		expect(odataParseValueByMetadata({ type: "string", abapBooleanLike: true }, " ")).toBe(false);
		expect(odataParseValueByMetadata({ type: "string", abapBooleanLike: true }, "")).toBe(false);
		expect(odataParseValueByMetadata({ type: "string", abapBooleanLike: true }, null)).toBe(false);
	});

	it("оставляет нетипичное значение boolean-like string как есть", () => {
		expect(odataParseValueByMetadata({ type: "string", abapBooleanLike: true }, "N")).toBe("N");
		expect(odataParseValueByMetadata({ type: "string", abapBooleanLike: true }, true)).toBe("true");
	});

	it("разрешает базовые UI-типы и списки formatter descriptions", () => {
		expect(getBaseTypeFromODataType("boolean")).toBe("boolean");
		expect(getBaseTypeFromODataType("decimal")).toBe("number");
		expect(getBaseTypeFromODataType("datetime")).toBe("date");
		expect(getBaseTypeFromODataType("string")).toBe("string");

		expect(getFormattersFor("datetime").map((item) => item.id)).toContain("base");
		expect(getFormattersFor("guid").map((item) => item.id)).toEqual(["base"]);
		expect(getFormattersForBaseType("date").map((item) => item.id)).toEqual(["base", "datetimeOffset", "time", "stringAbapDate"]);
		expect(getFormattersForBaseType("boolean").map((item) => item.id)).toEqual(["base", "asChar", "asByte"]);
		expect(getFormatter("datetime", "time")).toBeDefined();
		expect(getFormatter("datetime", "missing")).toBeUndefined();
		expect(getFormatterForBaseType("string", "base")?.fn("A")).toBe("'A'");
		expect(getFormatterForBaseType("number", "base")).toBeUndefined();
	});

	it("возвращает дефолтные значения по OData и control типам", () => {
		expect(defaultODataTypeValue("boolean")).toBe(false);
		expect(defaultODataTypeValue("int")).toBe(0);
		expect(defaultODataTypeValue("string")).toBe("");
		expect(defaultODataTypeValue("datetime")).toBeInstanceOf(Date);

		expect(defaultControlTypeValue("boolean")).toBe(false);
		expect(defaultControlTypeValue("number")).toBe(0);
		expect(defaultControlTypeValue("string")).toBe("");
		expect(defaultControlTypeValue("date")).toBeInstanceOf(Date);
	});

	it("валидирует args в formatter factory", () => {
		const sum = createNumberFormatter((left, right) => String(left + right));
		const bool = createBooleanFormatter((value) => (value ? "yes" : "no"));
		const text = createStringFormatter((value) => value.toUpperCase());
		const date = createDateFormatter((value) => ODataDateFormat.datetime(value));

		expect(sum(2, 3)).toBe("5");
		expect(bool(true)).toBe("yes");
		expect(text("abc")).toBe("ABC");
		expect(date(new Date(2026, 0, 2))).toBe("datetime'2026-01-02T00:00:00'");
		expect(() => sum(2, "3")).toThrow("Validation failed");
	});

	it("выбрасывает понятную ошибку для невалидного OData value", () => {
		expect(() => odataFormatValue("byte", 256)).toThrow("Некорректное значение");
		expect(() => odataFormatValue("datetime", "2026-07-03")).toThrow("Некорректное значение");
	});
});
