import { beforeEach, describe, expect, it, vi } from "vitest";

import { compileTableFormula, createTableFormulaContext, executeTableFormula } from "./execute";
import { configureTableFormulaRegistry, createTableFormulaRegistry } from "./registry";

beforeEach(() => {
	configureTableFormulaRegistry(
		createTableFormulaRegistry([
			{
				id: "sum",
				name: "Сумма",
				description: "Складывает два значения.",
				fn: (context) => context.num(0) + context.num(1)
			},
			{
				id: "ratio",
				name: "Отношение",
				description: "Делит первое значение на второе.",
				fn: (context) => {
					const divisor = context.num(1);
					return divisor === 0 ? 0 : context.num(0) / divisor;
				}
			},
			{ id: "invalid", name: "Невалидный результат", description: "Возвращает бесконечность.", fn: () => Infinity },
			{
				id: "runtime-error",
				name: "Ошибка выполнения",
				description: "Имитирует исключение пользовательской формулы.",
				fn: () => {
					throw new Error("Ошибка тестовой формулы");
				}
			}
		])
	);
});

describe("createTableFormulaV2Context", () => {
	it("формирует ctx на основе rowData и keys", () => {
		const onReadIndex = vi.fn();
		const onOutOfRangeIndex = vi.fn();
		const ctx = createTableFormulaContext({
			rowData: { MP_BC: 100, NETWR: "160", TEXT_INVALID: "x" },
			keys: ["MP_BC", "NETWR", "TEXT_INVALID"],
			instrumentation: { onReadIndex, onOutOfRangeIndex }
		});

		expect(ctx.key(0)).toBe("MP_BC");
		expect(ctx.value(0)).toBe(100);
		expect(ctx.value(1)).toBe("160");
		expect(ctx.num(1)).toBe(160);
		expect(ctx.num(2)).toBe(0);
		expect(ctx.key(100)).toBeUndefined();
		expect(ctx.key(-1)).toBeUndefined();
		expect(ctx.key(1.5)).toBeUndefined();
		expect(ctx.value(10)).toBeUndefined();
		expect(ctx.num(10)).toBe(0);
		expect(onReadIndex).toHaveBeenCalledWith(0);
		expect(onReadIndex).toHaveBeenCalledWith(10);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(100);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(-1);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(1.5);
	});
});

describe("executeTableFormula", () => {
	it("выполняет формулы активного реестра и защищает деление на ноль", () => {
		expect(executeTableFormula({ formulaId: "sum", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 15
		});
		expect(executeTableFormula({ formulaId: "ratio", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 2
		});
		expect(executeTableFormula({ formulaId: "ratio", rowData: { A: 10, B: 0 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 0
		});
	});

	it("преобразует невалидный результат и исключение формулы в безопасные ошибки", () => {
		expect(executeTableFormula({ formulaId: "invalid", rowData: {} })).toEqual({ ok: false, reason: "invalid_result" });
		expect(executeTableFormula({ formulaId: "runtime-error", rowData: {} })).toEqual({ ok: false, reason: "runtime_error" });
	});

	it("возвращает ошибку, если формула не найдена", () => {
		const result = executeTableFormula({
			formulaId: "missing",
			rowData: { A: 1 },
			keys: ["A"]
		});

		expect(result).toEqual({
			ok: false,
			reason: "formula_not_found"
		});
	});
});

describe("compileTableFormula", () => {
	it("компилирует формулу и переиспользует контекст между вызовами", () => {
		const compiled = compileTableFormula({
			formulaId: "ratio",
			keys: ["LEFT", "RIGHT"]
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const first = compiled.execute({ LEFT: 100, RIGHT: 20 });
		const second = compiled.execute({ LEFT: 120, RIGHT: 40 });

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;

		expect(first.value).toBe(5);
		expect(second.value).toBe(3);
	});

	it("компилирует формулу без ключей как безопасное выполнение с нулями", () => {
		const compiled = compileTableFormula({
			formulaId: "sum"
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		expect(compiled.execute({ A: 10, B: 20 })).toEqual({
			ok: true,
			value: 0
		});
	});

	it("не компилирует пустой formulaId", () => {
		expect(compileTableFormula({ formulaId: undefined })).toEqual({
			ok: false,
			reason: "formula_not_found"
		});
	});
});
