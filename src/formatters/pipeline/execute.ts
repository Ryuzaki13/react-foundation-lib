import { compileTableFormula } from "../../formulas";
import { getBaseTypeFromScalarType } from "../../metadata/scalarTypeClassification";
import { BASE_META_TYPE_NUMBER, BASE_META_TYPE_DATE } from "../../metadata/scalarTypeConstants";
import {
	VALUE_STATE_SUCCESS,
	VALUE_STATE_WARNING,
	VALUE_STATE_ERROR,
	VALUE_STATE_INFORMATION,
	VALUE_STATE_NONE
} from "../../types/valueStateConstants";
import { isSafe } from "../../validators";
import { formatDate, getDatePreset, parseDate } from "../date";
import { DATE_PRESET_NAME_DATE } from "../date/datePresetNameConstants";
import { normalizeLeadingZeros } from "../normalizeLeadingZeros";
import { formatNumber, getNumberPreset } from "../number";
import { NUMBER_PRESET_NAME_DECIMAL } from "../number/numberPresetNameConstants";
import { createRowBasedFormatterContext, getRowBasedFormatterById } from "../rowBased";
import { toSafeString } from "../strings";
import { registerFixedResolver } from "../valueState/fixedValueStateResolver";
import { registerThresholdResolver } from "../valueState/thresholdValueStateResolver";
import { resolveValueState } from "../valueState/valueStateRegistry";
import { VALUE_STATE_RESOLVER_KIND_FIXED, VALUE_STATE_RESOLVER_KIND_THRESHOLD } from "../valueState/valueStateResolverConstants";

import {
	PIPELINE_OVERRIDE_MODE_FIELD,
	PIPELINE_OVERRIDE_MODE_FORMULA,
	PIPELINE_ROW_KIND_GROUP,
	PIPELINE_ROW_KIND_PLAIN,
	PIPELINE_ROW_KIND_TREE,
	PIPELINE_ROW_KIND_TOTALS,
	PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
	PIPELINE_FORMATTER_TYPED_VALUE_FORMAT,
	PIPELINE_FORMATTER_RESOLVE_VALUE_STATE,
	PIPELINE_ICON_POSITION_LEFT,
	PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
	PIPELINE_STATE_SOURCE_FORMULA
} from "./formattersPipelineConstants";
import {
	PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_NOT_FOUND,
	PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_NOT_FOUND
} from "./pipelineValidationConstants";
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

const PIPELINE_EXECUTION_INVALID = "pipeline_invalid";
const PIPELINE_EXECUTION_ROW_BASED_FORMULA_NOT_FOUND = "row_based_formula_not_found";
const PIPELINE_EXECUTION_VALUE_STATE_FORMULA_NOT_FOUND = "value_state_formula_not_found";

type CompileFormattersPipelineExecutorResult =
	| {
			ok: true;
			executor: FormattersPipelineExecutor;
	  }
	| {
			ok: false;
			reason:
				| typeof PIPELINE_EXECUTION_INVALID
				| typeof PIPELINE_EXECUTION_ROW_BASED_FORMULA_NOT_FOUND
				| typeof PIPELINE_EXECUTION_VALUE_STATE_FORMULA_NOT_FOUND;
	  };

/**
 * Выполняет типизированное форматирование по метаданным колонки.
 */
export function formatTypedCellValue(
	value: unknown,
	column: FormattersPipelineTypedValueContext,
	config?: FormattersPipelineTypedValueFormatConfig
): string {
	if (!isSafe(value)) return "";

	const baseType = getBaseTypeFromScalarType(column.type);

	if (baseType === BASE_META_TYPE_NUMBER) {
		const normalizedPresetName = config?.numberPresetName?.trim();
		const presetName =
			normalizedPresetName && getNumberPreset(normalizedPresetName) ? normalizedPresetName : NUMBER_PRESET_NAME_DECIMAL;
		return formatNumber(value, presetName);
	}

	if (baseType === BASE_META_TYPE_DATE) {
		const normalizedPresetName = config?.datePresetName?.trim();
		const presetName = normalizedPresetName && getDatePreset(normalizedPresetName) ? normalizedPresetName : DATE_PRESET_NAME_DATE;
		return formatDate(parseDate(value), presetName);
	}

	return toSafeString(value);
}

function resolveIconState(value: string): FormattersPipelineValueIcon | undefined {
	if (
		value === VALUE_STATE_SUCCESS ||
		value === VALUE_STATE_WARNING ||
		value === VALUE_STATE_ERROR ||
		value === VALUE_STATE_INFORMATION
	) {
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
function shouldApplyRowBasedOverride(
	ctx: FormattersPipelineExecutionContext,
	mode: typeof PIPELINE_OVERRIDE_MODE_FIELD | typeof PIPELINE_OVERRIDE_MODE_FORMULA
): boolean {
	switch (ctx.rowKind) {
		case PIPELINE_ROW_KIND_GROUP:
		case PIPELINE_ROW_KIND_PLAIN:
		case PIPELINE_ROW_KIND_TREE:
			return true;
		case PIPELINE_ROW_KIND_TOTALS:
			return mode === PIPELINE_OVERRIDE_MODE_FORMULA;
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
		if (validation.errors.some((error) => error.code === PIPELINE_VALIDATION_STEP_VALUE_STATE_FORMULA_NOT_FOUND)) {
			return {
				ok: false,
				reason: PIPELINE_EXECUTION_VALUE_STATE_FORMULA_NOT_FOUND
			};
		}

		if (validation.errors.some((error) => error.code === PIPELINE_VALIDATION_STEP_ROW_BASED_OVERRIDE_FORMULA_NOT_FOUND)) {
			return {
				ok: false,
				reason: PIPELINE_EXECUTION_ROW_BASED_FORMULA_NOT_FOUND
			};
		}

		return {
			ok: false,
			reason: PIPELINE_EXECUTION_INVALID
		};
	}

	const { steps } = validation.plan;
	const hasRowBasedOverride = steps.some((step) => step.type === PIPELINE_FORMATTER_ROW_BASED_OVERRIDE);
	const hasTypedValueFormat = steps.some((step) => step.type === PIPELINE_FORMATTER_TYPED_VALUE_FORMAT);

	const valueStateStep = steps.find((step) => step.type === PIPELINE_FORMATTER_RESOLVE_VALUE_STATE);
	const valueStateSource = valueStateStep?.config.valueSource;
	// Формулу компилируем один раз вместе с колонкой, а не для каждой ячейки.
	const valueStateFormula =
		valueStateSource?.kind === PIPELINE_STATE_SOURCE_FORMULA
			? compileTableFormula({ formulaId: valueStateSource.formulaId, keys: valueStateSource.dependencyIds })
			: undefined;
	if (valueStateFormula && !valueStateFormula.ok) {
		return { ok: false, reason: PIPELINE_EXECUTION_VALUE_STATE_FORMULA_NOT_FOUND };
	}
	const valueStateResolverId =
		valueStateStep?.config.resolver.kind === VALUE_STATE_RESOLVER_KIND_FIXED
			? registerFixedResolver({
					entries: valueStateStep.config.resolver.entries,
					fallbackState: valueStateStep.config.resolver.fallbackState
				})
			: valueStateStep?.config.resolver.kind === VALUE_STATE_RESOLVER_KIND_THRESHOLD
				? registerThresholdResolver({
						thresholds: valueStateStep.config.resolver.thresholds,
						states: valueStateStep.config.resolver.states,
						invalidState: valueStateStep.config.resolver.invalidState
					})
				: undefined;

	const rowBasedOverrideStep = steps.find((step) => step.type === PIPELINE_FORMATTER_ROW_BASED_OVERRIDE);
	const rowBasedFormula =
		rowBasedOverrideStep?.config.mode === PIPELINE_OVERRIDE_MODE_FORMULA
			? getRowBasedFormatterById(rowBasedOverrideStep.config.formulaId)
			: undefined;
	if (rowBasedOverrideStep?.config.mode === PIPELINE_OVERRIDE_MODE_FORMULA && !rowBasedFormula) {
		return {
			ok: false,
			reason: PIPELINE_EXECUTION_ROW_BASED_FORMULA_NOT_FOUND
		};
	}

	return {
		ok: true,
		executor: {
			hasRowBasedOverride,
			hasTypedValueFormat,
			execute: (ctx: FormattersPipelineExecutionContext): FormattersPipelineExecutionResult => {
				let nextValue = ctx.value;
				let nextState: FormattersPipelineExecutionResult["state"] = VALUE_STATE_NONE;
				let showIcon = false;
				let showValue = true;
				let iconPosition: FormattersPipelineExecutionResult["iconPosition"] = PIPELINE_ICON_POSITION_LEFT;
				let icon: FormattersPipelineExecutionResult["icon"] = undefined;

				for (const step of steps) {
					switch (step.type) {
						case PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS:
							nextValue = normalizeLeadingZeros(nextValue, step.config?.fixed);
							break;
						case PIPELINE_FORMATTER_ROW_BASED_OVERRIDE:
							if (!shouldApplyRowBasedOverride(ctx, step.config.mode)) {
								break;
							}

							if (step.config.mode === PIPELINE_OVERRIDE_MODE_FIELD) {
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
						case PIPELINE_FORMATTER_RESOLVE_VALUE_STATE:
							if (!valueStateResolverId) {
								break;
							}

							if (valueStateSource?.kind === PIPELINE_STATE_SOURCE_FORMULA) {
								const rowData = ctx.valueStateFormulaRowData ?? ctx.rowData;
								// ctx.num() превращает отсутствующие значения в 0. Для состояния
								// отсутствие исходных данных нельзя выдавать за успешный расчёт.
								const hasDependencies = valueStateSource.dependencyIds.every(
									(dependencyId) =>
										Object.hasOwn(rowData, dependencyId) &&
										rowData[dependencyId] != null &&
										(typeof rowData[dependencyId] !== "string" || rowData[dependencyId].trim() !== "")
								);
								const result = hasDependencies && valueStateFormula?.ok ? valueStateFormula.execute(rowData) : undefined;
								nextState = result?.ok ? resolveValueState(valueStateResolverId, result.value) : VALUE_STATE_NONE;
							} else {
								nextState = resolveValueState(valueStateResolverId, nextValue);
							}
							showIcon = step.config.icon?.enabled ?? false;
							showValue = step.config.icon?.showValue ?? true;
							iconPosition = step.config.icon?.position ?? PIPELINE_ICON_POSITION_LEFT;
							icon = showIcon ? resolveIconState(nextState) : undefined;
							if (valueStateSource?.kind === PIPELINE_STATE_SOURCE_FORMULA && nextState === VALUE_STATE_NONE) {
								showIcon = false;
							}
							break;
						case PIPELINE_FORMATTER_TYPED_VALUE_FORMAT:
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
