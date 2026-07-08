import { describe, expect, it } from "vitest";

import { parseAbapBoolean, parseBoolean } from "./parseAbapBoolean";
import { toAbapBoolean } from "./toAbapBoolean";

describe("boolean formatters", () => {
	it("читает только точное ABAP-значение X как true", () => {
		expect(parseAbapBoolean("X")).toBe(true);
		expect(parseAbapBoolean("x")).toBe(false);
		expect(parseAbapBoolean(" ")).toBe(false);
		expect(parseAbapBoolean(true)).toBe(false);
	});

	it("читает пользовательские boolean-значения из строк и primitives", () => {
		expect(parseBoolean("true")).toBe(true);
		expect(parseBoolean("X")).toBe(true);
		expect(parseBoolean("1")).toBe(true);
		expect(parseBoolean("0")).toBe(false);
		expect(parseBoolean(1)).toBe(true);
		expect(parseBoolean(null)).toBe(false);
	});

	it("пишет ABAP boolean без промежуточных значений", () => {
		expect(toAbapBoolean(true)).toBe("X");
		expect(toAbapBoolean(false)).toBe(" ");
		expect(toAbapBoolean("0")).toBe(" ");
		expect(toAbapBoolean("false")).toBe("X");
	});
});
