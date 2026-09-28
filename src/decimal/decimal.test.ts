import { describe, expect, it } from "vitest";

import {
	addDecimals,
	compareDecimalRatios,
	compareDecimals,
	isCanonicalDecimal,
	multiplyDecimals,
	normalizeDecimal,
	subtractDecimals,
	sumDecimals
} from "./index";

describe("Канонические десятичные строки", () => {
	it.each(["0", "1", "-1", "0.3", "-0.01", "123456789012345678901234567890.123456789", "9".repeat(512)])(
		"принимает %s без потери цифр",
		(value) => expect(isCanonicalDecimal(value)).toBe(true)
	);

	it.each([
		undefined,
		null,
		1,
		{},
		"",
		"-0",
		"00",
		"01",
		"1.0",
		"0.00",
		".5",
		"1.",
		"+1",
		" 1",
		"1 ",
		"1\n",
		"1\r\n",
		"1e2",
		"1,5",
		"NaN",
		"Infinity",
		"1".repeat(513)
	])("отклоняет %s на runtime-границе", (value) => expect(isCanonicalDecimal(value)).toBe(false));

	it.each([
		["0001.2300", "1.23"],
		["-000.000", "0"],
		["000", "0"],
		["-0001.0200", "-1.02"],
		["1000.000", "1000"]
	])("нормализует %s в %s", (value, expected) => expect(normalizeDecimal(value)).toBe(expected));

	it.each(["+1", " 1", "1\n", "1e1000000000", "1,2", "1.", ".1", "9".repeat(513)])("не разворачивает внешний формат %s", (value) => {
		expect(() => normalizeDecimal(value)).toThrow(TypeError);
	});

	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
		"проверяет конфигурацию предела %s",
		(maxLength) => {
			expect(() => isCanonicalDecimal("1", { maxLength })).toThrow(RangeError);
			expect(() => sumDecimals([], { maxLength })).toThrow(RangeError);
		}
	);

	it("считает знак и точку частью предела", () => {
		expect(isCanonicalDecimal("-1", { maxLength: 1 })).toBe(false);
		expect(isCanonicalDecimal("0.1", { maxLength: 3 })).toBe(true);
		expect(isCanonicalDecimal("0.1", { maxLength: 2 })).toBe(false);
		expect(() => normalizeDecimal("0001", { maxLength: 3 })).toThrow(TypeError);
	});
});

describe("Точная арифметика", () => {
	it.each([
		["0.1", "0.2", "0.3"],
		["-0.1", "-0.2", "-0.3"],
		["1.25", "-1.25", "0"],
		["0.999", "0.001", "1"],
		["9007199254740993", "0.00000000000000000001", "9007199254740993.00000000000000000001"]
	])("складывает %s и %s в %s", (left, right, expected) => expect(addDecimals(left, right)).toBe(expected));

	it.each([
		["0.3", "0.1", "0.2"],
		["60", "65", "-5"],
		["0", "0.00000000000000000001", "-0.00000000000000000001"],
		["-1.3", "-0.2", "-1.1"]
	])("вычитает %s − %s точно", (left, right, expected) => expect(subtractDecimals(left, right)).toBe(expected));

	it.each([
		["0.1", "0.2", "0.02"],
		["-1.25", "0.8", "-1"],
		["-2", "-3", "6"],
		["36", "0.5", "18"],
		["100", "0.01", "1"],
		["9".repeat(512), "0", "0"]
	])("умножает %s × %s точно", (left, right, expected) => expect(multiplyDecimals(left, right)).toBe(expected));

	it.each([
		["-0.01", "0", -1],
		["0.3", "0.3", 0],
		["9007199254740993", "9007199254740992", 1],
		["-100", "-99.999", -1],
		["0.00000000000000000002", "0.00000000000000000001", 1]
	])("сравнивает %s и %s", (left, right, expected) => expect(compareDecimals(left, right)).toBe(expected));

	it("суммирует за один проход без накопления двоичной ошибки", () => {
		function* values() {
			for (let index = 0; index < 10000; index += 1) {
				yield "0.1";
			}
		}

		expect(sumDecimals(values())).toBe("1000");
		expect(sumDecimals([])).toBe("0");
		expect(sumDecimals(["1", "-1"])).toBe("0");
	});

	it("сохраняет максимальную разрядность и нормализует перенос", () => {
		const tiny = "0." + "0".repeat(509) + "1";
		const smaller = "0." + "0".repeat(508) + "1";

		expect(addDecimals(tiny, tiny)).toBe("0." + "0".repeat(509) + "2");
		expect(subtractDecimals(smaller, tiny)).toBe("0." + "0".repeat(509) + "9");
		expect(subtractDecimals("1" + "0".repeat(511), "1")).toBe("9".repeat(511));
	});

	it("отклоняет overflow результата и промежуточной суммы", () => {
		expect(() => addDecimals("9".repeat(512), "1")).toThrow(RangeError);
		expect(() => subtractDecimals("0", "1".repeat(512))).toThrow(RangeError);
		expect(() => multiplyDecimals("9".repeat(512), "10")).toThrow(RangeError);
		expect(() => multiplyDecimals("0." + "0".repeat(509) + "1", "0.1")).toThrow(RangeError);
		expect(() => sumDecimals(["99", "1", "-1"], { maxLength: 2 })).toThrow(RangeError);
	});

	it("отклоняет неканонические операнды независимо от нейтрального второго значения", () => {
		expect(() => addDecimals("1.0", "0")).toThrow(TypeError);
		expect(() => subtractDecimals("1", "-0")).toThrow(TypeError);
		expect(() => multiplyDecimals("1e1000000000", "0")).toThrow(TypeError);
		expect(() => compareDecimals("1", "1\n")).toThrow(TypeError);
	});

	it("проверяет алгебраические свойства на разных знаках и разрядностях", () => {
		const values = ["0", "0.01", "-0.01", "1", "-1", "0.1", "2.345", "-999.9", "9007199254740993"];

		for (const left of values) {
			for (const right of values) {
				expect(addDecimals(left, right)).toBe(addDecimals(right, left));
				expect(subtractDecimals(addDecimals(left, right), right)).toBe(left);
				expect(multiplyDecimals(left, right)).toBe(multiplyDecimals(right, left));
				expect(compareDecimals(left, right) + compareDecimals(right, left)).toBe(0);
				expect(isCanonicalDecimal(addDecimals(left, right))).toBe(true);
			}
		}
	});
});

describe("Отношения без округления", () => {
	it("различает точную треть и округлённое представление", () => {
		expect(compareDecimalRatios({ numerator: "10", denominator: "3" }, { numerator: "3.33", denominator: "1" })).toBe(1);
		expect(compareDecimalRatios({ numerator: "1", denominator: "3" }, { numerator: "2", denominator: "6" })).toBe(0);
		expect(compareDecimalRatios({ numerator: "-1", denominator: "3" }, { numerator: "0", denominator: "1" })).toBe(-1);
	});

	it("учитывает дробные знаменатели и большие приватные произведения", () => {
		expect(compareDecimalRatios({ numerator: "0.1", denominator: "0.2" }, { numerator: "1", denominator: "2" })).toBe(0);
		const large = "9".repeat(512);

		expect(compareDecimalRatios({ numerator: large, denominator: large }, { numerator: large, denominator: large })).toBe(0);
	});

	it.each(["0", "-1", "-0.01"])("отклоняет знаменатель %s с обеих сторон", (denominator) => {
		expect(() => compareDecimalRatios({ numerator: "1", denominator }, { numerator: "1", denominator: "1" })).toThrow(RangeError);
		expect(() => compareDecimalRatios({ numerator: "1", denominator: "1" }, { numerator: "1", denominator })).toThrow(RangeError);
	});
});
