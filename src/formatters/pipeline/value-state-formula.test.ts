import { beforeEach, describe, expect, it } from "vitest";

import { configureTableFormulaRegistry, createTableFormulaRegistry } from "../../formulas";

import { cloneFormattersPipelineConfig } from "./clone";
import { collectFormattersPipelineDependencyIds, collectRuntimeFieldDependencyIds } from "./dependencies";
import { compileFormattersPipelineExecutor } from "./execute";
import { normalizeFormattersPipelineConfig } from "./normalize";
import { rekeyFormattersPipelineConfig } from "./rekey";
import { compileFormattersPipelineRuntime, formatPipelineDisplayValue } from "./runtime";
import { validateFormattersPipelineConfig } from "./validate";

import type { FormattersPipelineConfig, FormattersPipelineResolveValueStateConfig, FormattersPipelineRowKind } from "./types";

beforeEach(() => {
	configureTableFormulaRegistry(
		createTableFormulaRegistry([
			{ id: "difference", name: "Разность", description: "Первый аргумент минус второй.", fn: (ctx) => ctx.num(0) - ctx.num(1) },
			{ id: "invalid", name: "Ошибка расчёта", description: "Неопределённое число.", fn: () => Number.NaN },
			{ id: "infinite", name: "Бесконечность", description: "Неконечный результат.", fn: () => Number.POSITIVE_INFINITY },
			{
				id: "null",
				name: "Пустой результат",
				description: "Нарушение числового контракта внешней формулой.",
				fn: () => null as unknown as number
			},
			{
				id: "throws",
				name: "Ошибка выполнения",
				description: "Исключение в формуле.",
				fn: () => {
					throw new Error("Ошибка расчёта");
				}
			}
		])
	);
});

function stateConfig(): FormattersPipelineResolveValueStateConfig {
	return {
		valueSource: { kind: "formula", formulaId: "difference", dependencyIds: ["ACTUAL", "PLAN"] },
		resolver: { kind: "threshold", thresholds: [0], states: ["warning", "success"], invalidState: "error" },
		icon: { enabled: true, showValue: true, position: "right" }
	};
}

function pipeline(config = stateConfig()): FormattersPipelineConfig {
	return {
		version: 1,
		plan: {
			steps: [
				{ id: "state", type: "resolveValueState", config },
				{ id: "typed", type: "typedValueFormat", config: { numberPresetName: "integer" } }
			]
		}
	};
}

function executeState(rowData: Record<string, unknown>, config = stateConfig(), rowKind: FormattersPipelineRowKind = "plain") {
	const compiled = compileFormattersPipelineExecutor({ config: pipeline(config), column: { type: "decimal", role: "measure" } });
	if (!compiled.ok) throw new Error(compiled.reason);
	return compiled.executor.execute({
		value: 500,
		rowData,
		rowKind,
		isGroupRow: rowKind === "group",
		isTotalsRow: rowKind === "totals",
		rowLevel: 0,
		groupingIds: [],
		columnId: "AMOUNT"
	});
}

describe("состояние по table formula", () => {
	it.each(["plain", "group", "totals", "tree"] as const)("рассчитывает состояние без изменения display value для %s", (rowKind) => {
		expect(executeState({ ACTUAL: 5, PLAN: 10 }, stateConfig(), rowKind)).toMatchObject({
			value: "500",
			state: "warning",
			icon: "warning",
			showIcon: true,
			showValue: true,
			iconPosition: "right"
		});
	});

	it("сохраняет порядок аргументов и корректный нулевой результат", () => {
		const reversed = stateConfig();
		reversed.valueSource = { kind: "formula", formulaId: "difference", dependencyIds: ["PLAN", "ACTUAL"] };
		expect(executeState({ ACTUAL: 5, PLAN: 10 }, reversed).state).toBe("success");
		expect(executeState({ ACTUAL: 0, PLAN: 0 })).toMatchObject({ value: "500", state: "success", icon: "success" });
	});

	it("поддерживает fixed resolver по результату формулы", () => {
		const config = stateConfig();
		config.resolver = { kind: "fixed", entries: { "0": "information" }, fallbackState: "error" };
		expect(executeState({ ACTUAL: 20, PLAN: 20 }, config)).toMatchObject({ value: "500", state: "information", icon: "information" });
	});

	it.each([{}, { ACTUAL: null }, { ACTUAL: undefined }, { ACTUAL: "" }, { ACTUAL: " \t " }])(
		"оставляет нейтральное состояние при отсутствующих данных %j",
		(partial) => {
			expect(executeState({ PLAN: 10, ...partial })).toMatchObject({ value: "500", state: "none", icon: undefined, showIcon: false });
		}
	);

	it("не использует унаследованные поля вместо данных строки", () => {
		const rowData: Record<string, unknown> = { PLAN: 10 };
		Object.setPrototypeOf(rowData, { ACTUAL: 20 });
		expect(executeState(rowData)).toMatchObject({ value: "500", state: "none", icon: undefined, showIcon: false });
	});

	it.each(["invalid", "infinite", "null", "throws"])("не применяет invalidState или fallbackState при ошибке формулы %s", (formulaId) => {
		for (const resolver of [stateConfig().resolver, { kind: "fixed" as const, entries: {}, fallbackState: "error" as const }]) {
			const config = stateConfig();
			config.valueSource = { kind: "formula", formulaId, dependencyIds: [] };
			config.resolver = resolver;
			expect(executeState({}, config)).toMatchObject({ value: "500", state: "none", icon: undefined, showIcon: false });
		}
	});

	it.each([undefined, { kind: "value" } as const])(
		"сохраняет определение состояния по текущему значению для источника %j",
		(valueSource) => {
			const config = stateConfig();
			config.valueSource = valueSource;
			expect(executeState({}, config)).toMatchObject({ value: "500", state: "success", icon: "success" });
		}
	);

	it("использует проекцию периода только для формулы состояния", () => {
		const config = pipeline();
		config.plan?.steps.unshift({ id: "display", type: "rowBasedOverride", config: { mode: "field", fieldKey: "ACTUAL" } });
		const field = compileFormattersPipelineRuntime({
			id: "AMOUNT",
			role: "measure" as const,
			type: "decimal" as const,
			formattersPipeline: config
		});
		expect(
			formatPipelineDisplayValue({
				field,
				rawValue: 500,
				rowData: { ACTUAL: 800, PLAN: 10 },
				valueStateFormulaRowData: { ACTUAL: 5, PLAN: 10 },
				rowKind: "plain"
			})
		).toMatchObject({ value: "800", state: "warning", icon: "warning" });
	});

	it("отклоняет неизвестную формулу при компиляции", () => {
		const config = stateConfig();
		config.valueSource = { kind: "formula", formulaId: "missing", dependencyIds: ["ACTUAL", "PLAN"] };
		expect(compileFormattersPipelineExecutor({ config: pipeline(config), column: { type: "decimal", role: "measure" } })).toEqual({
			ok: false,
			reason: "value_state_formula_not_found"
		});
	});

	it("валидирует formulaId и индексные зависимости", () => {
		for (const [source, code] of [
			[{ kind: "formula" as const, formulaId: " ", dependencyIds: [] }, "step_value_state_formula_id_empty"],
			[{ kind: "formula" as const, formulaId: "difference", dependencyIds: [" ", "PLAN"] }, "step_value_state_dependency_id_empty"],
			[
				{ kind: "formula" as const, formulaId: "difference", dependencyIds: ["ACTUAL"] },
				"step_value_state_dependency_index_out_of_range"
			]
		] as const) {
			const config = stateConfig();
			config.valueSource = { ...source, dependencyIds: [...source.dependencyIds] };
			expect(validateFormattersPipelineConfig(pipeline(config)).errors.map((error) => error.code)).toContain(code);
		}
	});

	it("собирает зависимости для скрытых полей и сообщает consumer о недоступных полях", () => {
		expect(collectFormattersPipelineDependencyIds(pipeline())).toEqual(["ACTUAL", "PLAN"]);
		expect(collectRuntimeFieldDependencyIds(["AMOUNT"], { AMOUNT: { formattersPipeline: pipeline() }, ACTUAL: {} })).toEqual({
			requiredColumnIds: ["ACTUAL"],
			missingColumnIds: ["PLAN"]
		});
	});

	it("сохраняет повторяющиеся позиционные аргументы, дедуплицируя только query-поля", () => {
		const config = stateConfig();
		config.valueSource = { kind: "formula", formulaId: "difference", dependencyIds: ["ACTUAL", "ACTUAL"] };
		const normalized = normalizeFormattersPipelineConfig(pipeline(config));
		expect(normalized?.plan?.steps[0]).toMatchObject({ config: { valueSource: { dependencyIds: ["ACTUAL", "ACTUAL"] } } });
		expect(collectFormattersPipelineDependencyIds(normalized)).toEqual(["ACTUAL"]);
		expect(executeState({ ACTUAL: 8 }, config).state).toBe("success");
	});

	it("клонирует сериализованный источник без нормализации его позиционных аргументов", () => {
		const config = stateConfig();
		config.valueSource = { kind: "formula", formulaId: "difference", dependencyIds: [" ", "ACTUAL", "ACTUAL"] };
		const cloned = cloneFormattersPipelineConfig(pipeline(config));
		const rekeyed = rekeyFormattersPipelineConfig(pipeline(config));
		for (const result of [cloned, rekeyed]) {
			expect(result?.plan?.steps[0]).toMatchObject({ config: { valueSource: { dependencyIds: [" ", "ACTUAL", "ACTUAL"] } } });
		}
	});

	it.each([
		null,
		{ kind: "field" },
		{ kind: "formula", formulaId: 1, dependencyIds: [] },
		{ kind: "formula", formulaId: "difference" },
		{ kind: "formula", formulaId: "difference", dependencyIds: [1] }
	])("отбрасывает malformed JSON источника %j", (valueSource) => {
		const config = pipeline();
		const state = config.plan?.steps[0];
		if (state?.type !== "resolveValueState") throw new Error("Шаг состояния не найден");
		Object.defineProperty(state.config, "valueSource", { value: valueSource });
		expect(normalizeFormattersPipelineConfig(config)).toBeUndefined();
	});

	it("сохраняет источник при нормализации, клонировании и переиздании id графа", () => {
		const state = stateConfig();
		const config: FormattersPipelineConfig = {
			version: 1,
			graph: {
				nodes: [
					{ id: "source", type: "source", position: { x: 0, y: 0 } },
					{ id: "state", type: "resolveValueState", position: { x: 100, y: 0 }, config: state },
					{ id: "sink", type: "sink", position: { x: 200, y: 0 } }
				],
				edges: [
					{ id: "e1", source: "source", target: "state" },
					{ id: "e2", source: "state", target: "sink" }
				]
			}
		};
		for (const result of [
			normalizeFormattersPipelineConfig(config),
			cloneFormattersPipelineConfig(config),
			rekeyFormattersPipelineConfig(config)
		]) {
			const cloned = result?.graph?.nodes[1];
			if (cloned?.type !== "resolveValueState") throw new Error("Шаг состояния не найден");
			expect(cloned.config.valueSource).toEqual(state.valueSource);
			expect(cloned.config.valueSource).not.toBe(state.valueSource);
			if (cloned.config.valueSource?.kind !== "formula" || state.valueSource?.kind !== "formula")
				throw new Error("Источник формулы не найден");
			expect(cloned.config.valueSource.dependencyIds).not.toBe(state.valueSource.dependencyIds);
		}
		const plan = validateFormattersPipelineConfig(config).plan;
		const step = plan?.steps[0];
		expect(step?.type === "resolveValueState" && step.config.valueSource).toEqual(state.valueSource);
		expect(step?.type === "resolveValueState" && step.config.valueSource).not.toBe(state.valueSource);
	});
});
