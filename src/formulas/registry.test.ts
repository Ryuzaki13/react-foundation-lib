import { afterEach, describe, expect, it } from "vitest";

import { configureTableFormulaRegistry, createTableFormulaRegistry, getTableFormulaById, getTableFormulaList } from "./registry";

afterEach(() => {
	configureTableFormulaRegistry(createTableFormulaRegistry([]));
});

describe("table formula registry", () => {
	it("нормализует определения и изолирует созданные реестры", () => {
		const first = createTableFormulaRegistry([
			{
				id: " sum ",
				name: " Сумма ",
				description: " Складывает значения. ",
				keywords: ["арифметика"],
				fn: (context) => context.num(0) + context.num(1)
			}
		]);
		const second = createTableFormulaRegistry([]);

		expect(first.list[0]).toMatchObject({
			id: "sum",
			name: "Сумма",
			description: "Складывает значения.",
			keywords: ["арифметика"]
		});
		expect(first.byId.get("sum")).toBe(first.list[0]);
		expect(second.list).toEqual([]);
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.list)).toBe(true);
		expect(Object.isFrozen(first.list[0])).toBe(true);
	});

	it("отклоняет пустые и дублирующиеся id", () => {
		expect(() => createTableFormulaRegistry([{ id: " ", name: "A", description: "", fn: () => 0 }])).toThrow("не может быть пустым");
		expect(() =>
			createTableFormulaRegistry([
				{ id: "sum", name: "A", description: "", fn: () => 0 },
				{ id: " sum ", name: "B", description: "", fn: () => 0 }
			])
		).toThrow("дублирующийся");
	});

	it("переключает активный реестр для runtime API", () => {
		const registry = createTableFormulaRegistry([
			{ id: "sum", name: "Сумма", description: "Складывает значения.", fn: (context) => context.num(0) + context.num(1) }
		]);

		configureTableFormulaRegistry(registry);

		expect(getTableFormulaList()).toBe(registry.list);
		expect(getTableFormulaById(" sum ")).toBe(registry.list[0]);
		expect(getTableFormulaById(undefined)).toBeUndefined();
	});
});
