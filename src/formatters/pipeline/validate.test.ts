import { describe, expect, it } from "vitest";

import type { FormattersPipelineConfig, FormattersPipelineGraph, FormattersPipelineStep } from "./types";
import { validateFormattersPipelineConfig } from "./validate";

type ValidationCode = ReturnType<typeof validateFormattersPipelineConfig>["errors"][number]["code"];

const position = { x: 0, y: 0 };

function errorCodes(result: ReturnType<typeof validateFormattersPipelineConfig>): ValidationCode[] {
	return result.errors.map((item) => item.code);
}

function warningCodes(result: ReturnType<typeof validateFormattersPipelineConfig>): ValidationCode[] {
	return result.warnings.map((item) => item.code);
}

function configWithSteps(steps: FormattersPipelineStep[]): FormattersPipelineConfig {
	return {
		version: 1,
		plan: { steps }
	};
}

function validGraph(): FormattersPipelineGraph {
	return {
		nodes: [
			{ id: "source", type: "source", position },
			{ id: "typed", type: "typedValueFormat", position },
			{ id: "sink", type: "sink", position }
		],
		edges: [
			{ id: "e1", source: "source", target: "typed" },
			{ id: "e2", source: "typed", target: "sink" }
		]
	};
}

describe("table column formatters pipeline validate", () => {
	it("валидирует базовые ошибки конфигурации", () => {
		const unsupportedVersionConfig: FormattersPipelineConfig = {
			version: 1,
			plan: { steps: [] }
		};
		Object.defineProperty(unsupportedVersionConfig, "version", { value: 2 });

		expect(errorCodes(validateFormattersPipelineConfig(undefined))).toEqual(["config_not_defined"]);
		expect(errorCodes(validateFormattersPipelineConfig(unsupportedVersionConfig))).toEqual(["unsupported_version"]);
		expect(errorCodes(validateFormattersPipelineConfig({ version: 1 }))).toEqual(["graph_or_plan_required"]);
	});

	it("валидирует линейный граф и строит plan", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			graph: {
				nodes: [
					{ id: "source", type: "source", position: { x: 0, y: 0 } },
					{ id: "n1", type: "normalizeLeadingZeros", position: { x: 100, y: 0 }, config: { fixed: 3 } },
					{
						id: "n2",
						type: "resolveValueState",
						position: { x: 200, y: 0 },
						config: {
							resolver: {
								kind: "fixed",
								entries: { A: "success" },
								fallbackState: "none"
							}
						}
					},
					{ id: "n3", type: "typedValueFormat", position: { x: 300, y: 0 } },
					{ id: "sink", type: "sink", position: { x: 400, y: 0 } }
				],
				edges: [
					{ id: "e1", source: "source", target: "n1" },
					{ id: "e2", source: "n1", target: "n2" },
					{ id: "e3", source: "n2", target: "n3" },
					{ id: "e4", source: "n3", target: "sink" }
				]
			}
		});

		expect(result.ok).toBe(true);
		expect(result.plan?.steps.map((step) => step.type)).toEqual(["normalizeLeadingZeros", "resolveValueState", "typedValueFormat"]);
	});

	it("при невалидном plan пробует построить plan из graph", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{ id: "dup", type: "typedValueFormat" },
					{ id: "dup", type: "typedValueFormat" }
				]
			},
			graph: validGraph()
		});

		expect(result.ok).toBe(true);
		expect(warningCodes(result)).toContain("path_broken");
		expect(result.plan?.steps.map((step) => step.id)).toEqual(["typed"]);
	});

	it("валидирует дубли, пустые id и несовместимые настройки шагов", () => {
		const result = validateFormattersPipelineConfig(
			configWithSteps([
				{ id: " ", type: "typedValueFormat" },
				{ id: "typed", type: "typedValueFormat", config: { numberPresetName: " " } },
				{ id: "typed", type: "typedValueFormat", config: { numberPresetName: "decimal" } },
				{ id: "zero-a", type: "normalizeLeadingZeros" },
				{ id: "zero-b", type: "normalizeLeadingZeros" },
				{
					id: "row-field",
					type: "rowBasedOverride",
					config: { mode: "field", fieldKey: " " }
				},
				{
					id: "row-formula",
					type: "rowBasedOverride",
					config: { mode: "formula", formulaId: " ", dependencyIds: ["A"] }
				},
				{
					id: "state-a",
					type: "resolveValueState",
					config: {
						resolver: {
							kind: "threshold",
							thresholds: [10],
							states: ["success"],
							invalidState: "none"
						},
						icon: { enabled: false, showValue: false }
					}
				},
				{
					id: "state-b",
					type: "resolveValueState",
					config: {
						resolver: {
							kind: "fixed",
							entries: {},
							fallbackState: "none"
						}
					}
				}
			])
		);

		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"step_id_duplicate",
				"step_typed_value_format_preset_empty",
				"step_typed_value_format_multiple",
				"step_normalize_leading_zeros_multiple",
				"step_row_based_override_field_key_empty",
				"step_row_based_override_formula_id_empty",
				"step_row_based_override_multiple",
				"step_threshold_states_count_invalid",
				"step_resolve_value_state_multiple",
				"step_typed_before_value_state"
			])
		);
		expect(warningCodes(result)).toContain("step_value_hidden_without_icon");
	});

	it("не допускает порядок typedValueFormat до resolveValueState", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{ id: "typed", type: "typedValueFormat" },
					{
						id: "state",
						type: "resolveValueState",
						config: {
							resolver: {
								kind: "fixed",
								entries: { A: "success" },
								fallbackState: "none"
							}
						}
					}
				]
			}
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "step_typed_before_value_state")).toBe(true);
	});

	it("не допускает более одного resolveValueState", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{
						id: "stateA",
						type: "resolveValueState",
						config: {
							resolver: {
								kind: "fixed",
								entries: { A: "success" },
								fallbackState: "none"
							}
						}
					},
					{
						id: "stateB",
						type: "resolveValueState",
						config: {
							resolver: {
								kind: "fixed",
								entries: { B: "warning" },
								fallbackState: "none"
							}
						}
					}
				]
			}
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "step_resolve_value_state_multiple")).toBe(true);
	});

	it("не допускает неизвестный numberPresetName в typedValueFormat", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{
						id: "typed",
						type: "typedValueFormat",
						config: {
							numberPresetName: "unknown_preset"
						}
					}
				]
			}
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "step_typed_value_format_preset_not_found")).toBe(true);
	});

	it("валидирует существование rowBasedOverride formula", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{
						id: "rowBased",
						type: "rowBasedOverride",
						config: {
							mode: "formula",
							formulaId: "unknown_row_based_formula",
							dependencyIds: ["A"]
						}
					}
				]
			}
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "step_row_based_override_formula_not_found")).toBe(true);
	});

	it("валидирует количество зависимостей rowBasedOverride formula по реально используемым индексам", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{
						id: "rowBased",
						type: "rowBasedOverride",
						config: {
							mode: "formula",
							formulaId: "divideWhenAgFormatter",
							dependencyIds: ["A"]
						}
					}
				]
			}
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((item) => item.code === "step_row_based_override_dependency_index_out_of_range")).toBe(true);
		expect(result.errors[0]?.message).toContain("Минимально требуется зависимостей: 2");
	});

	it("предупреждает о неиспользуемых зависимостях rowBasedOverride formula", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{
						id: "rowBased",
						type: "rowBasedOverride",
						config: {
							mode: "formula",
							formulaId: "valueWhenFieldOrNull",
							dependencyIds: ["A", "B"]
						}
					}
				]
			}
		});

		expect(result.ok).toBe(true);
		expect(result.warnings.some((item) => item.code === "step_row_based_override_unused_dependencies")).toBe(true);
	});

	it("ошибается, если rowBasedOverride formula читает dependency index вне диапазона", () => {
		const result = validateFormattersPipelineConfig({
			version: 1,
			plan: {
				steps: [
					{
						id: "rowBased",
						type: "rowBasedOverride",
						config: {
							mode: "formula",
							formulaId: "divideWhenFieldOrNull",
							dependencyIds: []
						}
					}
				]
			}
		});

		expect(result.ok).toBe(false);
		expect(errorCodes(result)).toContain("step_row_based_override_dependency_index_out_of_range");
		expect(warningCodes(result)).not.toContain("step_row_based_override_formula_does_not_use_dependencies");
	});

	it("валидирует структуру графа до построения плана", () => {
		expect(
			errorCodes(
				validateFormattersPipelineConfig({
					version: 1,
					graph: { nodes: [], edges: [] }
				})
			)
		).toEqual(["path_broken"]);

		expect(
			errorCodes(
				validateFormattersPipelineConfig({
					version: 1,
					graph: {
						nodes: [
							{ id: "source", type: "source", position },
							{ id: "source", type: "source", position },
							{ id: "sink", type: "sink", position }
						],
						edges: [
							{ id: "e", source: "source", target: "sink" },
							{ id: "e", source: "source", target: "sink" }
						]
					}
				})
			)
		).toEqual(["node_id_duplicate", "edge_id_duplicate"]);

		expect(
			errorCodes(
				validateFormattersPipelineConfig({
					version: 1,
					graph: {
						nodes: [
							{ id: "source", type: "source", position },
							{ id: "sink", type: "sink", position }
						],
						edges: [{ id: "e", source: "source", target: "missing" }]
					}
				})
			)
		).toContain("edge_node_not_found");
	});

	it("валидирует source/sink degree и disconnected nodes", () => {
		expect(
			errorCodes(
				validateFormattersPipelineConfig({
					version: 1,
					graph: {
						nodes: [{ id: "sink", type: "sink", position }],
						edges: []
					}
				})
			)
		).toEqual(["source_count_invalid"]);

		expect(
			errorCodes(
				validateFormattersPipelineConfig({
					version: 1,
					graph: {
						nodes: [
							{ id: "source", type: "source", position },
							{ id: "typed", type: "typedValueFormat", position },
							{ id: "sink", type: "sink", position }
						],
						edges: [
							{ id: "e1", source: "source", target: "typed" },
							{ id: "e2", source: "typed", target: "source" }
						]
					}
				})
			)
		).toEqual(expect.arrayContaining(["source_incoming_invalid", "node_degree_invalid"]));

		expect(
			errorCodes(
				validateFormattersPipelineConfig({
					version: 1,
					graph: {
						nodes: [
							{ id: "source", type: "source", position },
							{ id: "sink", type: "sink", position },
							{ id: "a", type: "typedValueFormat", position },
							{ id: "b", type: "typedValueFormat", position }
						],
						edges: [
							{ id: "e1", source: "source", target: "sink" },
							{ id: "e2", source: "a", target: "b" },
							{ id: "e3", source: "b", target: "a" }
						]
					}
				})
			)
		).toContain("path_disconnected_nodes");
	});
});
