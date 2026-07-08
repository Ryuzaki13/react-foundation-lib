import { describe, expect, it } from "vitest";

import { collectFormattersPipelineDependencyIds, collectRuntimeFieldDependencyIds, type RuntimeDependencyField } from "./dependencies";

import type { FormattersPipelineConfig } from "./types";

function pipeline(steps: NonNullable<FormattersPipelineConfig["plan"]>["steps"]): FormattersPipelineConfig {
	return {
		version: 1,
		plan: {
			steps
		}
	};
}

describe("collectFormattersPipelineDependencyIds", () => {
	it("собирает зависимости formatter pipeline без дублей", () => {
		const config = pipeline([
			{
				id: "state",
				type: "rowBasedOverride",
				config: {
					mode: "formula",
					formulaId: "valueWhenFieldOrNull",
					dependencyIds: ["STATUS_TEXT", "STATUS_COLOR", "STATUS_TEXT"]
				}
			}
		]);

		expect(collectFormattersPipelineDependencyIds(config)).toEqual(["STATUS_TEXT", "STATUS_COLOR"]);
	});
});

describe("collectRuntimeFieldDependencyIds", () => {
	it("собирает renderer bindings и formatter-зависимости по минимальному контракту поля", () => {
		const fieldsById: Record<string, RuntimeDependencyField> = {
			MANAGER: {
				cellRenderer: {
					bindings: {
						label: "MANAGER_NAME",
						url: "MANAGER_URL"
					}
				},
				formattersPipeline: pipeline([
					{
						id: "text",
						type: "rowBasedOverride",
						config: {
							mode: "field",
							fieldKey: "MANAGER_NAME"
						}
					}
				])
			},
			MANAGER_NAME: {},
			MANAGER_URL: {}
		};

		expect(collectRuntimeFieldDependencyIds(["MANAGER"], fieldsById)).toEqual({
			requiredColumnIds: ["MANAGER_NAME", "MANAGER_URL"],
			missingColumnIds: []
		});
	});

	it("разделяет найденные и отсутствующие зависимости", () => {
		const fieldsById: Record<string, RuntimeDependencyField> = {
			STATUS: {
				formattersPipeline: pipeline([
					{
						id: "state",
						type: "rowBasedOverride",
						config: {
							mode: "formula",
							formulaId: "valueWhenFieldOrNull",
							dependencyIds: ["STATUS_TEXT", "TEXT_MISSING_STATUS"]
						}
					}
				])
			},
			STATUS_TEXT: {}
		};

		expect(collectRuntimeFieldDependencyIds(["STATUS"], fieldsById)).toEqual({
			requiredColumnIds: ["STATUS_TEXT"],
			missingColumnIds: ["TEXT_MISSING_STATUS"]
		});
	});

	it("сохраняет порядок первого появления зависимости", () => {
		const fieldsById: Record<string, RuntimeDependencyField> = {
			FIRST: {
				cellRenderer: {
					bindings: {
						first: "SHARED",
						second: "FIRST_ONLY"
					}
				}
			},
			SECOND: {
				cellRenderer: {
					bindings: {
						first: "SHARED",
						second: "SECOND_ONLY"
					}
				}
			},
			SHARED: {},
			FIRST_ONLY: {},
			SECOND_ONLY: {}
		};

		expect(collectRuntimeFieldDependencyIds(["FIRST", "SECOND"], fieldsById)).toEqual({
			requiredColumnIds: ["SHARED", "FIRST_ONLY", "SECOND_ONLY"],
			missingColumnIds: []
		});
	});
});
