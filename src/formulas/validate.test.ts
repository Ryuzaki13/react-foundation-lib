import { beforeEach, describe, expect, it } from "vitest";

import { configureTableFormulaRegistry, createTableFormulaRegistry } from "./registry";
import { validateTableFormulaDependencies } from "./validate";

beforeEach(() => {
	configureTableFormulaRegistry(
		createTableFormulaRegistry([
			{
				id: "pair-sum",
				name: "Сумма пары",
				description: "Складывает два значения.",
				fn: (context) => context.num(0) + context.num(1)
			}
		])
	);
});

describe("validateTableFormulaDependencies", () => {
	it("возвращает ok для корректной конфигурации", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "pair-sum",
			dependencies: ["LEFT", "RIGHT"],
			availableColumnIds: ["LEFT", "RIGHT", "EXTRA"]
		});

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.usage.requiredDependencyCount).toBe(2);
	});

	it("возвращает ошибку, если зависимостей меньше, чем запрашивает формула", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "pair-sum",
			dependencies: ["LEFT"],
			availableColumnIds: ["LEFT", "RIGHT"]
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "dependency_index_out_of_range")).toBe(true);
	});

	it("возвращает warning для неиспользуемых зависимостей", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "pair-sum",
			dependencies: ["LEFT", "RIGHT", "EXTRA"],
			availableColumnIds: ["LEFT", "RIGHT", "EXTRA"]
		});

		expect(result.ok).toBe(true);
		expect(result.warnings.some((item) => item.code === "unused_dependencies")).toBe(true);
	});

	it("возвращает ошибку, если зависимость не входит в доступные колонки", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "pair-sum",
			dependencies: ["LEFT", "MISSING"],
			availableColumnIds: ["LEFT", "RIGHT"]
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "dependency_not_available")).toBe(true);
	});

	it("возвращает ошибку, если формула не найдена", () => {
		const result = validateTableFormulaDependencies({
			formulaId: "unknown",
			dependencies: ["A"],
			availableColumnIds: ["A"]
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "formula_not_found")).toBe(true);
	});
});
