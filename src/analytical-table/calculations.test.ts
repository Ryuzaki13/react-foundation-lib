import { afterEach, describe, expect, it } from "vitest";

import { configureTableFormulaRegistry, createTableFormulaRegistry } from "../formulas";

import { calculateAnalyticalValues, createAnalyticalCalculationPlan } from "./index";
import { type AnalyticalColumn } from "./index";

afterEach(() => configureTableFormulaRegistry(createTableFormulaRegistry([])));

describe("план вычислений аналитической таблицы", () => {
	it("раскрывает скрытые зависимости в порядке вычисления и использует общий реестр формул", () => {
		configureTableFormulaRegistry(
			createTableFormulaRegistry([
				{ id: "difference", name: "Разность", description: "", fn: (context) => context.num(0) - context.num(1) }
			])
		);
		const columns: AnalyticalColumn[] = [
			{ id: "result", formula: { formulaId: "difference", dependencies: ["twice", "base"] } },
			{ id: "twice", calculate: { dependencies: ["base"], compute: (values) => Number(values.base) * 2 } },
			{ id: "base" },
			{ id: "unused" }
		];
		const plan = createAnalyticalCalculationPlan(columns, ["result"]);
		expect(plan.requiredColumnIds).toEqual(["base", "twice", "result"]);
		const source = Object.freeze({ base: 7 });
		expect(calculateAnalyticalValues(source, plan)).toEqual({ base: 7, twice: 14, result: 7 });
		expect(source).toEqual({ base: 7 });
	});
	it("выявляет цикл и отсутствующую зависимость до обработки строк", () => {
		expect(() =>
			createAnalyticalCalculationPlan([
				{ id: "a", calculate: { dependencies: ["b"], compute: () => 1 } },
				{ id: "b", calculate: { dependencies: ["a"], compute: () => 1 } }
			])
		).toThrow("Циклическая");
		expect(() => createAnalyticalCalculationPlan([{ id: "a", calculate: { dependencies: ["missing"], compute: () => 1 } }])).toThrow(
			"Неизвестная"
		);
	});
	it("не превращает ошибочную формулу в успешный ноль", () => {
		expect(() => createAnalyticalCalculationPlan([{ id: "a", formula: { formulaId: "missing", dependencies: [] } }])).toThrow(
			"не зарегистрирована"
		);
		configureTableFormulaRegistry(createTableFormulaRegistry([{ id: "invalid", name: "", description: "", fn: () => NaN }]));
		const plan = createAnalyticalCalculationPlan([{ id: "a", formula: { formulaId: "invalid", dependencies: [] } }]);
		expect(() => calculateAnalyticalValues({}, plan)).toThrow("invalid_result");
	});
});
