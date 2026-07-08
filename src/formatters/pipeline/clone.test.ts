import { describe, expect, it } from "vitest";

import {
	cloneFormatterPipelinePlanStep,
	cloneFormatterPipelinePlanStepToNode,
	cloneFormattersPipelineConfig,
	cloneResolveValueStateConfig,
	cloneRowBasedOverrideConfig
} from "./clone";

import type {
	FormattersPipelineConfig,
	FormattersPipelineResolveValueStateConfig,
	FormattersPipelineRowBasedOverrideConfig,
	FormattersPipelineStep
} from "./types";

describe("cloneFormattersPipelineConfig", () => {
	it("возвращает undefined для пустого конфига", () => {
		expect(cloneFormattersPipelineConfig(undefined)).toBeUndefined();
	});

	it("глубоко клонирует plan, graph, позиции, edges и viewport", () => {
		const config: FormattersPipelineConfig = {
			version: 1,
			plan: {
				steps: [
					{ id: "zeros", type: "normalizeLeadingZeros", config: { fixed: 4 } },
					{
						id: "override",
						type: "rowBasedOverride",
						config: { mode: "formula", formulaId: "valueWhenFieldOrNull", dependencyIds: ["A"], fallbackToRaw: true }
					},
					{
						id: "state",
						type: "resolveValueState",
						config: {
							resolver: {
								kind: "threshold",
								thresholds: [{ value: 10, boundary: "lower" }, 20],
								states: ["warning", "success", "error"],
								invalidState: "none"
							},
							icon: { enabled: true, showValue: false, position: "right" }
						}
					},
					{ id: "typed", type: "typedValueFormat", config: { numberPresetName: "decimal-2" } }
				]
			},
			graph: {
				nodes: [
					{ id: "source", type: "source", position: { x: 0, y: 0 } },
					{ id: "typed", type: "typedValueFormat", position: { x: 100, y: 0 }, config: { datePresetName: "date" } },
					{ id: "sink", type: "sink", position: { x: 200, y: 0 } }
				],
				edges: [{ id: "edge", source: "source", target: "typed" }],
				viewport: { x: 1, y: 2, zoom: 0.8 }
			}
		};

		const clone = cloneFormattersPipelineConfig(config);

		expect(clone).toEqual(config);
		expect(clone).not.toBe(config);
		expect(clone?.plan).not.toBe(config.plan);
		expect(clone?.plan?.steps[1]).not.toBe(config.plan?.steps[1]);
		expect(clone?.graph).not.toBe(config.graph);
		expect(clone?.graph?.nodes[1]).not.toBe(config.graph?.nodes[1]);
		expect(clone?.graph?.edges[0]).not.toBe(config.graph?.edges[0]);
		expect(clone?.graph?.viewport).not.toBe(config.graph?.viewport);

		const clonedOverride = clone?.plan?.steps[1];
		const originalOverride = config.plan?.steps[1];
		if (clonedOverride?.type === "rowBasedOverride" && originalOverride?.type === "rowBasedOverride") {
			expect(clonedOverride.config).not.toBe(originalOverride.config);
			if (clonedOverride.config.mode === "formula" && originalOverride.config.mode === "formula") {
				expect(clonedOverride.config.dependencyIds).not.toBe(originalOverride.config.dependencyIds);
			}
		}
	});
});

describe("pipeline clone helpers", () => {
	it("клонирует rowBasedOverride field и formula config независимо", () => {
		const fieldConfig: FormattersPipelineRowBasedOverrideConfig = { mode: "field", fieldKey: "DISPLAY", fallbackToRaw: true };
		const formulaConfig: FormattersPipelineRowBasedOverrideConfig = {
			mode: "formula",
			formulaId: "valueWhenFieldOrNull",
			dependencyIds: ["A", "B"]
		};

		expect(cloneRowBasedOverrideConfig(fieldConfig)).toEqual(fieldConfig);

		const formulaClone = cloneRowBasedOverrideConfig(formulaConfig);
		expect(formulaClone).toEqual(formulaConfig);
		expect(formulaClone).not.toBe(formulaConfig);
		if (formulaClone.mode === "formula") {
			expect(formulaClone.dependencyIds).not.toBe(formulaConfig.dependencyIds);
		}
	});

	it("клонирует fixed и threshold value-state config без общих вложенных ссылок", () => {
		const fixedConfig: FormattersPipelineResolveValueStateConfig = {
			resolver: { kind: "fixed", entries: { A: "success" }, fallbackState: "none" },
			icon: { enabled: true }
		};
		const thresholdConfig: FormattersPipelineResolveValueStateConfig = {
			resolver: {
				kind: "threshold",
				thresholds: [{ value: 1, boundary: "upper" }],
				states: ["warning", "success"]
			}
		};

		const fixedClone = cloneResolveValueStateConfig(fixedConfig);
		const thresholdClone = cloneResolveValueStateConfig(thresholdConfig);

		expect(fixedClone).toEqual(fixedConfig);
		expect(fixedClone.resolver).not.toBe(fixedConfig.resolver);
		expect(fixedClone.icon).not.toBe(fixedConfig.icon);
		expect(thresholdClone).toEqual(thresholdConfig);
		expect(thresholdClone.resolver).not.toBe(thresholdConfig.resolver);
		if (thresholdClone.resolver.kind === "threshold" && thresholdConfig.resolver.kind === "threshold") {
			expect(thresholdClone.resolver.thresholds).not.toBe(thresholdConfig.resolver.thresholds);
			expect(thresholdClone.resolver.thresholds[0]).not.toBe(thresholdConfig.resolver.thresholds[0]);
			expect(thresholdClone.resolver.states).not.toBe(thresholdConfig.resolver.states);
		}
	});

	it("преобразует step в node с собственной позицией", () => {
		const step: FormattersPipelineStep = {
			id: "typed",
			type: "typedValueFormat",
			config: { numberPresetName: "integer" }
		};
		const position = { x: 10, y: 20 };
		const node = cloneFormatterPipelinePlanStepToNode(step, position);

		expect(node).toEqual({ ...step, position });
		expect(node.position).not.toBe(position);
	});

	it("выбрасывает ошибку для недопустимого типа step", () => {
		const invalidStep = { id: "invalid", type: "unknown" } as unknown as FormattersPipelineStep;

		expect(() => cloneFormatterPipelinePlanStep(invalidStep)).toThrow("Недопустимый тип");
		expect(() => cloneFormatterPipelinePlanStepToNode(invalidStep, { x: 0, y: 0 })).toThrow("Недопустимый тип");
	});
});
