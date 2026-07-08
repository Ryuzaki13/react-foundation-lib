import { describe, expect, it } from "vitest";

import { normalizeFormattersPipelineConfig } from "./normalize";
import { type FormattersPipelineConfig } from "./types";

describe("normalizeFormattersPipelineConfig", () => {
	it("клонирует валидный pipeline config", () => {
		const config: FormattersPipelineConfig = {
			version: 1,
			plan: {
				steps: [
					{
						id: "typed",
						type: "typedValueFormat",
						config: {
							numberPresetName: "decimal-2"
						}
					}
				]
			}
		};

		const normalized = normalizeFormattersPipelineConfig(config);

		expect(normalized).toEqual(config);
		expect(normalized).not.toBe(config);
		expect(normalized?.plan).not.toBe(config.plan);
	});

	it("отбрасывает невалидный pipeline config", () => {
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								numberPresetName: "missing"
							}
						}
					]
				}
			})
		).toBeUndefined();
	});

	it("не падает на malformed JSON", () => {
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: {
					steps: [
						{
							id: 1,
							type: "rowBasedOverride",
							config: {
								mode: "field"
							}
						}
					]
				}
			})
		).toBeUndefined();
	});

	it("принимает валидный graph с source/sink и строит независимый clone", () => {
		const config: FormattersPipelineConfig = {
			version: 1,
			graph: {
				nodes: [
					{ id: "source", type: "source", position: { x: 0, y: 0 } },
					{
						id: "override",
						type: "rowBasedOverride",
						position: { x: 100, y: 0 },
						config: { mode: "field", fieldKey: "DISPLAY", fallbackToRaw: true }
					},
					{ id: "sink", type: "sink", position: { x: 200, y: 0 } }
				],
				edges: [
					{ id: "e1", source: "source", target: "override" },
					{ id: "e2", source: "override", target: "sink" }
				]
			}
		};

		const normalized = normalizeFormattersPipelineConfig(config);

		expect(normalized).toEqual(config);
		expect(normalized?.graph).not.toBe(config.graph);
		expect(normalized?.graph?.nodes[1]).not.toBe(config.graph?.nodes[1]);
	});

	it("принимает threshold resolver с icon-настройками", () => {
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: {
					steps: [
						{
							id: "state",
							type: "resolveValueState",
							config: {
								resolver: {
									kind: "threshold",
									thresholds: [{ value: 10, boundary: "lower" }],
									states: ["warning", "success"],
									invalidState: "none"
								},
								icon: { enabled: true, showValue: false, position: "left" }
							}
						}
					]
				}
			})
		).toMatchObject({ version: 1 });
	});

	it("отбрасывает config без plan и graph", () => {
		expect(normalizeFormattersPipelineConfig({ version: 1 })).toBeUndefined();
		expect(normalizeFormattersPipelineConfig(null)).toBeUndefined();
		expect(normalizeFormattersPipelineConfig({ version: 2, plan: { steps: [] } })).toBeUndefined();
	});

	it("отбрасывает невалидные icon, threshold и edge формы", () => {
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: {
					steps: [
						{
							id: "state",
							type: "resolveValueState",
							config: {
								resolver: { kind: "threshold", thresholds: [{ value: 10, boundary: "middle" }], states: ["success"] },
								icon: { position: "center" }
							}
						}
					]
				}
			})
		).toBeUndefined();

		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				graph: {
					nodes: [{ id: "source", type: "source", position: { x: 0, y: 0 } }],
					edges: [{ id: "edge", source: "source" }]
				}
			})
		).toBeUndefined();
	});

	it("отбрасывает malformed step configs по каждому типу formatter", () => {
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: { steps: [{ id: "typed", type: "typedValueFormat", config: { numberPresetName: 1 } }] }
			})
		).toBeUndefined();
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: { steps: [{ id: "zero", type: "normalizeLeadingZeros", config: { fixed: "4" } }] }
			})
		).toBeUndefined();
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: {
					steps: [{ id: "row", type: "rowBasedOverride", config: { mode: "formula", formulaId: "markup", dependencyIds: [1] } }]
				}
			})
		).toBeUndefined();
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				plan: {
					steps: [
						{
							id: "state",
							type: "resolveValueState",
							config: { resolver: { kind: "fixed", entries: { A: "unknown" }, fallbackState: "none" } }
						}
					]
				}
			})
		).toBeUndefined();
	});

	it("отбрасывает malformed graph nodes и positions", () => {
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				graph: {
					nodes: [{ id: "source", type: "source", position: { x: "0", y: 0 } }],
					edges: []
				}
			})
		).toBeUndefined();
		expect(
			normalizeFormattersPipelineConfig({
				version: 1,
				graph: {
					nodes: [{ id: "node", type: "unknown", position: { x: 0, y: 0 } }],
					edges: []
				}
			})
		).toBeUndefined();
	});
});
