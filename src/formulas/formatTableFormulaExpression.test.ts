import { describe, expect, it } from "vitest";

import { formatTableFormulaExpression } from "./formatTableFormulaExpression";

describe("formatTableFormulaExpression", () => {
	it.each([
		["$0 / $1", ["VALUE", { kind: "constant", value: 100 }], "VALUE / 100"],
		["$0 / $1", [{ kind: "constant", value: 100 }, "VALUE"], "100 / VALUE"],
		[
			"$0 + $1",
			[
				{ kind: "constant", value: 0 },
				{ kind: "constant", value: 0 }
			],
			"0 + 0"
		],
		["$0 - $1", ["VALUE", { kind: "constant", value: -2.5 }], "VALUE - (-2.5)"],
		["$0 / $1", ["VALUE", { kind: "constant", value: Number.NaN }], "VALUE / $1"]
	] as const)("форматирует константы в %s", (template, dependencies, expected) => {
		expect(formatTableFormulaExpression(template, dependencies)).toBe(expected);
	});

	it.each([
		["$0 / $1", ["FIELD_X", "FIELD_Y"], "FIELD_X / FIELD_Y"],
		["$0 / $1", ["FIELD_Y", "FIELD_X"], "FIELD_Y / FIELD_X"],
		["$0 / $1", ["FIELD_X"], "FIELD_X / $1"],
		["$0 / $1", [], "$0 / $1"],
		["$0 / $1", ["", "FIELD_Y"], "$0 / FIELD_Y"],
		["100 * $0 / ($1 + $0)", ["X", "Y"], "100 * X / (Y + X)"],
		["42", ["FIELD_X"], "42"],
		["", ["FIELD_X"], ""]
	] as const)("форматирует %s с позиционными зависимостями", (template, dependencies, expected) => {
		expect(formatTableFormulaExpression(template, dependencies)).toBe(expected);
	});

	it("различает одно- и многозначные индексы", () => {
		const dependencies = Array.from({ length: 11 }, (_, index) => `FIELD_${index}`);
		expect(formatTableFormulaExpression("$1 + $10 + $100", dependencies)).toBe("FIELD_1 + FIELD_10 + $100");
	});

	it("сохраняет ID буквально без рекурсивной подстановки и нормализации", () => {
		const dependencies = ["  FIELD_X  ", "$1-$&-\\value", "FIELD_Y"] as const;
		expect(formatTableFormulaExpression("$0 + $1 + $2", dependencies)).toBe("  FIELD_X   + $1-$&-\\value + FIELD_Y");
		expect(dependencies).toEqual(["  FIELD_X  ", "$1-$&-\\value", "FIELD_Y"]);
	});
});
