import { getBaseTypeFromODataType } from "../../odata-service";
import { isSafe } from "../../validators";
import { formatDate, getDatePreset, parseDate } from "../date";
import { normalizeLeadingZeros } from "../normalizeLeadingZeros";
import { formatNumber, getNumberPreset } from "../number";
import { createRowBasedFormatterContext, getRowBasedFormatterById } from "../rowBased";
import { toSafeString } from "../strings";
import { registerFixedResolver } from "../valueState/fixedValueStateResolver";
import { registerThresholdResolver } from "../valueState/thresholdValueStateResolver";
import { resolveValueState } from "../valueState/valueStateRegistry";

import { validateFormattersPipelineConfig } from "./validate";

import type {
	FormattersPipelineConfig,
	FormattersPipelineExecutionContext,
	FormattersPipelineExecutionResult,
	FormattersPipelineExecutor,
	FormattersPipelineTypedValueContext,
	FormattersPipelineTypedValueFormatConfig,
	FormattersPipelineValueIcon
} from "./types";

type CompileFormattersPipelineExecutorResult =
	| {
			ok: true;
			executor: FormattersPipelineExecutor;
	  }
	| {
			ok: false;
			reason: "pipeline_invalid" | "row_based_formula_not_found";
	  };

const DEFAULT_TYPED_VALUE_FORMAT_PRESETS = Object.freeze({
	number: "decimal",
	date: "date"
});

/**
 * Выполняет типизированное форматирование по метаданным колонки.
 */
export function formatTypedCellValue(
	value: unknown,
	column: FormattersPipelineTypedValueContext,
	config?: FormattersPipelineTypedValueFormatConfig
): string {
	if (!isSafe(value)) return "";

	const baseType = getBaseTypeFromODataType(column.type);

	if (baseType === "number") {
		const normalizedPresetName = config?.numberPresetName?.trim();
		const presetName =
			normalizedPresetName && getNumberPreset(normalizedPresetName)
				? normalizedPresetName
				: DEFAULT_TYPED_VALUE_FORMAT_PRESETS.number;
		return formatNumber(value, presetName);
	}

	if (baseType === "date") {
		const normalizedPresetName = config?.datePresetName?.trim();
		const presetName =
			normalizedPresetName && getDatePreset(normalizedPresetName) ? normalizedPresetName : DEFAULT_TYPED_VALUE_FORMAT_PRESETS.date;
		return formatDate(parseDate(value), presetName);
	}

	return toSafeString(value);
}

function resolveIconState(value: string): FormattersPipelineValueIcon | undefined {
	if (value === "success" || value === "warning" || value === "error" || value === "information") {
		return value;
	}

	return undefined;
}

/**
 * Определяет, должен ли `rowBasedOverride` применяться для текущего типа строки.
 *
 * Семантика:
 * - `group` — historical analytical group-row;
 * - `totals` — применяется только formula-режим;
 * - `plain`/`tree` — generic row-based override.
 */
function shouldApplyRowBasedOverride(ctx: FormattersPipelineExecutionContext, mode: "field" | "formula"): boolean {
	switch (ctx.rowKind) {
		case "group":
		case "plain":
		case "tree":
			return true;
		case "totals":
			return mode === "formula";
	}
}

/**
 * Компилирует pipeline форматтеров колонки в runtime executor.
 */
export function compileFormattersPipelineExecutor(args: {
	config: FormattersPipelineConfig | undefined;
	column: FormattersPipelineTypedValueContext;
}): CompileFormattersPipelineExecutorResult {
	const validation = validateFormattersPipelineConfig(args.config);
	if (!validation.ok || !validation.plan) {
		if (validation.errors.some((error) => error.code === "step_row_based_override_formula_not_found")) {
			return {
				ok: false,
				reason: "row_based_formula_not_found"
			};
		}

		return {
			ok: false,
			reason: "pipeline_invalid"
		};
	}

	const { steps } = validation.plan;
	const hasRowBasedOverride = steps.some((step) => step.type === "rowBasedOverride");
	const hasTypedValueFormat = steps.some((step) => step.type === "typedValueFormat");

	const valueStateStep = steps.find((step) => step.type === "resolveValueState");
	const valueStateResolverId =
		valueStateStep?.config.resolver.kind === "fixed"
			? registerFixedResolver({
					entries: valueStateStep.config.resolver.entries,
					fallbackState: valueStateStep.config.resolver.fallbackState
				})
			: valueStateStep?.config.resolver.kind === "threshold"
				? registerThresholdResolver({
						thresholds: valueStateStep.config.resolver.thresholds,
						states: valueStateStep.config.resolver.states,
						invalidState: valueStateStep.config.resolver.invalidState
					})
				: undefined;

	const rowBasedOverrideStep = steps.find((step) => step.type === "rowBasedOverride");
	const rowBasedFormula =
		rowBasedOverrideStep?.config.mode === "formula" ? getRowBasedFormatterById(rowBasedOverrideStep.config.formulaId) : undefined;
	if (rowBasedOverrideStep?.config.mode === "formula" && !rowBasedFormula) {
		return {
			ok: false,
			reason: "row_based_formula_not_found"
		};
	}

	return {
		ok: true,
		executor: {
			hasRowBasedOverride,
			hasTypedValueFormat,
			execute: (ctx: FormattersPipelineExecutionContext): FormattersPipelineExecutionResult => {
				let nextValue = ctx.value;
				let nextState: FormattersPipelineExecutionResult["state"] = "none";
				let showIcon = false;
				let showValue = true;
				let iconPosition: FormattersPipelineExecutionResult["iconPosition"] = "left";
				let icon: FormattersPipelineExecutionResult["icon"] = undefined;

				for (const step of steps) {
					switch (step.type) {
						case "normalizeLeadingZeros":
							nextValue = normalizeLeadingZeros(nextValue, step.config?.fixed);
							break;
						case "rowBasedOverride":
							if (!shouldApplyRowBasedOverride(ctx, step.config.mode)) {
								break;
							}

							if (step.config.mode === "field") {
								const fieldValue = ctx.rowData[step.config.fieldKey];
								if (fieldValue == null && step.config.fallbackToRaw !== false) {
									break;
								}

								nextValue = fieldValue;
								break;
							}

							if (!rowBasedFormula) {
								break;
							}

							try {
								const formulaValue = rowBasedFormula.fn(
									createRowBasedFormatterContext({
										rowData: ctx.rowData,
										rawValue: nextValue,
										columnId: ctx.columnId,
										keys: step.config.dependencyIds
									})
								);
								if (formulaValue == null && step.config.fallbackToRaw !== false) {
									break;
								}
								nextValue = formulaValue;
							} catch {
								if (step.config.fallbackToRaw === false) {
									nextValue = undefined;
								}
							}
							break;
						case "resolveValueState":
							if (!valueStateResolverId) {
								break;
							}

							nextState = resolveValueState(valueStateResolverId, nextValue);
							showIcon = step.config.icon?.enabled ?? false;
							showValue = step.config.icon?.showValue ?? true;
							iconPosition = step.config.icon?.position ?? "left";
							icon = showIcon ? resolveIconState(nextState) : undefined;
							break;
						case "typedValueFormat":
							nextValue = formatTypedCellValue(nextValue, args.column, step.config);
							break;
					}
				}

				return {
					value: nextValue,
					state: nextState,
					icon,
					showIcon,
					showValue,
					iconPosition,
					hasTypedValueFormat
				};
			}
		}
	};
}
