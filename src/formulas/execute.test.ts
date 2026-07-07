import { describe, expect, it, vi } from "vitest";

import { compileTableFormula, createTableFormulaContext, executeTableFormula } from "./execute";

describe("createTableFormulaV2Context", () => {
	it("формирует ctx на основе rowData и keys", () => {
		const onReadIndex = vi.fn();
		const onOutOfRangeIndex = vi.fn();
		const ctx = createTableFormulaContext({
			rowData: { MP_BC: 100, NETWR: "160", BAD: "x" },
			keys: ["MP_BC", "NETWR", "BAD"],
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

describe("executeTableFormulaV2", () => {
	it("выполняет базовые арифметические формулы и защищает деление на ноль", () => {
		expect(executeTableFormula({ formulaId: "add", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 15
		});
		expect(executeTableFormula({ formulaId: "substract", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 5
		});
		expect(executeTableFormula({ formulaId: "multiply", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 50
		});
		expect(executeTableFormula({ formulaId: "divide", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 2
		});
		expect(executeTableFormula({ formulaId: "divide", rowData: { A: 10, B: 0 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 0
		});
		expect(executeTableFormula({ formulaId: "percent", rowData: { A: 0, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 0
		});
	});

	it("выполняет формулу v2 из реестра", () => {
		const result = executeTableFormula({
			formulaId: "markup",
			rowData: { MP_BC: 100, NETWR: 160 },
			keys: ["MP_BC", "NETWR"]
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toBeCloseTo(166.6666, 3);
	});

	it("выполняет sales-формулы и возвращает invalid_result для бесконечности", () => {
		const markupSsc = executeTableFormula({
			formulaId: "markup_ssc",
			rowData: { A: 120, B: 20, C: 50 },
			keys: ["A", "B", "C"]
		});
		const growth = executeTableFormula({
			formulaId: "growth_percent",
			rowData: { A: 120, B: 100 },
			keys: ["A", "B"]
		});
		const sscPerTon = executeTableFormula({
			formulaId: "ssc_per_ton",
			rowData: { A: 100, B: 20, C: 10 },
			keys: ["A", "B", "C"]
		});
		const invalid = executeTableFormula({
			formulaId: "plan_deviation_percent",
			rowData: { FACT: 100, PLAN: 0 },
			keys: ["FACT", "PLAN"]
		});

		expect(markupSsc).toEqual({ ok: true, value: 2 });
		expect(growth).toEqual({ ok: true, value: 20 });
		expect(executeTableFormula({ formulaId: "growth_percent", rowData: { A: 120, B: 0 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 0
		});
		expect(sscPerTon).toEqual({ ok: true, value: 200 });
		expect(invalid).toEqual({ ok: false, reason: "invalid_result" });
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

describe("compileTableFormulaV2", () => {
	it("компилирует формулу и переиспользует контекст между вызовами", () => {
		const compiled = compileTableFormula({
			formulaId: "markup",
			keys: ["MP_BC", "NETWR"]
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const first = compiled.execute({ MP_BC: 100, NETWR: 160 });
		const second = compiled.execute({ MP_BC: 120, NETWR: 200 });

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;

		expect(first.value).toBeCloseTo(166.6666, 3);
		expect(second.value).toBeCloseTo(150, 3);
	});

	it("компилирует формулу без ключей как безопасное выполнение с нулями", () => {
		const compiled = compileTableFormula({
			formulaId: "add"
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
