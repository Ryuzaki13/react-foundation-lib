import { describe, expect, it } from "vitest";

import { type BaseMetaType, type ScalarMetaType } from "./metadataTypes";
import {
	getBaseTypeFromScalarType,
	isScalarBooleanType,
	isScalarDateType,
	isScalarIntegerType,
	isScalarNumericType
} from "./scalarTypeClassification";

const scalarKinds = [
	["boolean", "boolean"],
	["byte", "number"],
	["int", "number"],
	["long", "number"],
	["float", "number"],
	["decimal", "number"],
	["double", "number"],
	["datetime", "date"],
	["datetimeOffset", "date"],
	["time", "date"],
	["string", "string"],
	["guid", "string"],
	["binary", "string"]
] as const satisfies readonly (readonly [ScalarMetaType, BaseMetaType])[];

describe("общая классификация scalar metadata", () => {
	it.each(scalarKinds)("сохраняет базовый тип %s → %s", (type, expected) => {
		expect(getBaseTypeFromScalarType(type)).toBe(expected);
		expect(isScalarBooleanType(type)).toBe(expected === "boolean");
		expect(isScalarDateType(type)).toBe(expected === "date");
		expect(isScalarNumericType(type)).toBe(expected === "number");
		expect(isScalarIntegerType(type)).toBe(["byte", "int", "long"].includes(type));
	});

	it("не превращает прежний string fallback в новую runtime-валидацию", () => {
		expect(Reflect.apply(getBaseTypeFromScalarType, undefined, ["unexpected-type"])).toBe("string");
		for (const guard of [isScalarBooleanType, isScalarDateType, isScalarNumericType, isScalarIntegerType]) {
			expect(guard(undefined)).toBe(false);
		}
	});
});
