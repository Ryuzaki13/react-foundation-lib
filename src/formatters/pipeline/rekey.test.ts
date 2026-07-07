import { describe, expect, it } from "vitest";

import { rekeyFormattersPipelineConfig } from "./rekey";

function createIdFactory() {
	let index = 0;
	return () => {
		index += 1;
		return `uuid-${index}`;
	};
}

describe("formatters pipeline rekey", () => {
	it("возвращает undefined для пустого config", () => {
		expect(rekeyFormattersPipelineConfig(undefined, createIdFactory())).toBeUndefined();
	});

	it("заменяет id шагов плана на технические uuid", () => {
		const result = rekeyFormattersPipelineConfig(
			{
				version: 1,
				plan: {
					steps: [
						{
							id: "typedValueFormat-NETWR",
							type: "typedValueFormat",
							config: { numberPresetName: "currency" }
						}
					]
				}
			},
			createIdFactory()
		);

		expect(result?.plan?.steps).toEqual([
			{
				id: "uuid-1",
				type: "typedValueFormat",
				config: { numberPresetName: "currency" }
			}
		]);
	});

	it("клонирует настройки всех типов шагов плана", () => {
		const dependencyIds = ["A", "B"];
		const threshold = { value: 10, boundary: "lower" as const };
		const result = rekeyFormattersPipelineConfig(
			{
				version: 1,
				plan: {
					steps: [
						{ id: "zero", type: "normalizeLeadingZeros", config: { fixed: 4 } },
						{ id: "field", type: "rowBasedOverride", config: { mode: "field", fieldKey: "DISPLAY", fallbackToRaw: true } },
						{ id: "formula", type: "rowBasedOverride", config: { mode: "formula", formulaId: "markup", dependencyIds } },
						{
							id: "state-fixed",
							type: "resolveValueState",
							config: { resolver: { kind: "fixed", entries: { A: "success" }, fallbackState: "none" } }
						},
						{
							id: "state-threshold",
							type: "resolveValueState",
							config: {
								resolver: {
									kind: "threshold",
									thresholds: [threshold],
									states: ["warning", "success"],
									invalidState: "none"
								},
								icon: { enabled: true, position: "right" }
							}
						}
					]
				}
			},
			createIdFactory()
		);

		expect(result?.plan?.steps.map((step) => step.id)).toEqual(["uuid-1", "uuid-2", "uuid-3", "uuid-4", "uuid-5"]);
		expect(result?.plan?.steps[2]).toMatchObject({
			type: "rowBasedOverride",
			config: { mode: "formula", formulaId: "markup", dependencyIds: ["A", "B"] }
		});
		expect(
			result?.plan?.steps[2]?.type === "rowBasedOverride" && result.plan.steps[2].config.mode === "formula"
				? result.plan.steps[2].config.dependencyIds
				: undefined
		).not.toBe(dependencyIds);
		expect(
			result?.plan?.steps[4]?.type === "resolveValueState" && result.plan.steps[4].config.resolver.kind === "threshold"
				? result.plan.steps[4].config.resolver.thresholds[0]
				: undefined
		).not.toBe(threshold);
	});

	it("синхронно заменяет id graph и plan, построенный из graph", () => {
		const result = rekeyFormattersPipelineConfig(
			{
				version: 1,
				graph: {
					nodes: [
						{ id: "source", type: "source", position: { x: 0, y: 0 } },
						{
							id: "typedValueFormat-NETWR",
							type: "typedValueFormat",
							position: { x: 100, y: 0 },
							config: { numberPresetName: "currency" }
						},
						{ id: "sink", type: "sink", position: { x: 200, y: 0 } }
					],
					edges: [
						{ id: "edge-source-old", source: "source", target: "typedValueFormat-NETWR" },
						{ id: "edge-old-sink", source: "typedValueFormat-NETWR", target: "sink" }
					]
				},
				plan: {
					steps: [
						{
							id: "typedValueFormat-NETWR",
							type: "typedValueFormat",
							config: { numberPresetName: "currency" }
						}
					]
				}
			},
			createIdFactory()
		);

		expect(result?.graph?.nodes.map((node) => node.id)).toEqual(["source", "uuid-1", "sink"]);
		expect(result?.graph?.edges).toEqual([
			{ id: "uuid-2", source: "source", target: "uuid-1" },
			{ id: "uuid-3", source: "uuid-1", target: "sink" }
		]);
		expect(result?.plan?.steps.map((step) => step.id)).toEqual(["uuid-1"]);
	});

	it("сохраняет rekey plan, если graph после rekey невалиден", () => {
		const result = rekeyFormattersPipelineConfig(
			{
				version: 1,
				graph: {
					nodes: [
						{ id: "source", type: "source", position: { x: 0, y: 0 } },
						{ id: "sink", type: "sink", position: { x: 100, y: 0 } }
					],
					edges: [{ id: "broken", source: "source", target: "missing" }],
					viewport: { x: 1, y: 2, zoom: 3 }
				},
				plan: {
					steps: [{ id: "typed", type: "typedValueFormat" }]
				}
			},
			createIdFactory()
		);

		expect(result?.graph?.viewport).toEqual({ x: 1, y: 2, zoom: 3 });
		expect(result?.plan?.steps).toEqual([{ id: "uuid-2", type: "typedValueFormat", config: undefined }]);
	});
});
