import { describe, expect, it } from "vitest";

import { collectRuntimeFieldDependencyIds, type RuntimeDependencyField } from "./dependencies";

import type { FormattersPipelineConfig } from "./types";

function pipeline(steps: NonNullable<FormattersPipelineConfig["plan"]>["steps"]): FormattersPipelineConfig {
	return {
		version: 1,
		plan: {
			steps
		}
	};
}

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
