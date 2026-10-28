import { compileTableFormula, type TableFormulaCompiledExecutor, type TableFormulaRowData } from "../../formulas";
import { TABLE_FORMULA_NOT_FOUND } from "../../formulas/tableFormulaConstants";
import { VALUE_STATE_NONE } from "../../types/valueStateConstants";
import { isZeroValue } from "../number";
import { toSafeString } from "../strings";

import { compileFormattersPipelineExecutor, formatTypedCellValue } from "./execute";
import { PIPELINE_ICON_POSITION_LEFT, PIPELINE_ROW_KIND_GROUP, PIPELINE_ROW_KIND_TOTALS } from "./formattersPipelineConstants";

import type {
	FormatPipelineDisplayValueArgs,
	FormattersPipelineDisplayValue,
	FormattersPipelineExecutionResult,
	FormattersPipelineRuntimeField,
	FormattersPipelineRuntimeFields
} from "./types";

type ResolvedPipelineSourceValue = {
	value: unknown;
	shouldRenderEmpty: boolean;
};

const missingFormulaExecutor: TableFormulaCompiledExecutor = () => ({ ok: false, reason: TABLE_FORMULA_NOT_FOUND });

function createDefaultDisplayValue(value: unknown, overflowTooltip: boolean): FormattersPipelineDisplayValue {
	return {
		value,
		state: VALUE_STATE_NONE,
		showIcon: false,
		showValue: true,
		iconPosition: PIPELINE_ICON_POSITION_LEFT,
		overflowTooltip
	};
}

function formatFallbackValue(value: unknown, field: Pick<FormattersPipelineRuntimeField, "role" | "type"> | undefined): string {
	if (!field) {
		return toSafeString(value);
	}

	return formatTypedCellValue(value, field);
}

function compileFormulaExecutor(field: FormattersPipelineRuntimeField): TableFormulaCompiledExecutor | undefined {
	if (!field.formulaId) {
		return undefined;
	}

	const compiled = compileTableFormula({
		formulaId: field.formulaId,
		keys: field.formulaDependencies
	});

	return compiled.ok ? compiled.execute : missingFormulaExecutor;
}

function resolvePipelineSourceValue(
	rawValue: unknown,
	rowData: TableFormulaRowData,
	field: Readonly<FormattersPipelineRuntimeField>
): ResolvedPipelineSourceValue {
	if (!field.formulaId) {
		return {
			value: rawValue,
			shouldRenderEmpty: false
		};
	}

	if (!field.formulaExecutor) {
		return {
			value: field.purelyDerived ? undefined : rawValue,
			shouldRenderEmpty: field.purelyDerived === true
		};
	}

	const execution = field.formulaExecutor(rowData);
	if (execution.ok) {
		return {
			value: execution.value,
			shouldRenderEmpty: false
		};
	}

	return {
		value: field.purelyDerived ? undefined : rawValue,
		shouldRenderEmpty: field.purelyDerived === true
	};
}

function executePipelineFormatting<TField extends FormattersPipelineRuntimeField>(
	args: FormatPipelineDisplayValueArgs<TField>,
	sourceValue: unknown,
	field: Readonly<TField>
): FormattersPipelineDisplayValue {
	const executor = field.formattersPipelineExecutor;
	if (!executor) {
		return createDefaultDisplayValue(formatFallbackValue(sourceValue, field), field.overflowTooltip === true);
	}

	const execution: FormattersPipelineExecutionResult = executor.execute({
		value: sourceValue,
		rowData: args.rowData,
		valueStateFormulaRowData: args.valueStateFormulaRowData,
		rowKind: args.rowKind,
		isGroupRow: args.rowKind === PIPELINE_ROW_KIND_GROUP,
		isTotalsRow: args.rowKind === PIPELINE_ROW_KIND_TOTALS,
		rowLevel: args.rowLevel ?? 0,
		groupingIds: args.groupingIds ?? [],
		columnId: field.id
	});
	const value = execution.hasTypedValueFormat ? execution.value : formatFallbackValue(execution.value, field);

	return {
		value,
		state: execution.state,
		icon: execution.icon,
		showIcon: execution.showIcon,
		showValue: execution.showValue,
		iconPosition: execution.iconPosition,
		overflowTooltip: field.overflowTooltip === true
	};
}

function applyDisplayPostProcessing(
	displayValue: FormattersPipelineDisplayValue,
	sourceValue: ResolvedPipelineSourceValue,
	field: Readonly<FormattersPipelineRuntimeField>
): FormattersPipelineDisplayValue {
	if (sourceValue.shouldRenderEmpty) {
		return {
			...displayValue,
			value: ""
		};
	}

	if (field.emptyWhenZero && isZeroValue(sourceValue.value)) {
		return {
			...displayValue,
			value: ""
		};
	}

	return displayValue;
}

/**
 * Компилирует formula/pipeline runtime прямо в исходный объект поля.
 *
 * Функция предназначена только для construction-stage: до помещения полей в
 * readonly context, memoized snapshot или query-independent cache.
 */
export function compileFormattersPipelineRuntime<TField extends FormattersPipelineRuntimeField>(field: TField): Readonly<TField> {
	const formulaExecutor = compileFormulaExecutor(field);
	if (formulaExecutor) {
		field.formulaExecutor = formulaExecutor;
	} else {
		delete field.formulaExecutor;
	}

	if (!field.formattersPipeline) {
		delete field.formattersPipelineExecutor;
		return field;
	}

	const compiled = compileFormattersPipelineExecutor({
		config: field.formattersPipeline,
		column: field
	});

	if (compiled.ok) {
		field.formattersPipelineExecutor = compiled.executor;
	} else {
		delete field.formattersPipelineExecutor;
	}

	return field;
}

/**
 * Компилирует runtime-карту без пересборки самих полей.
 */
export function compileFormattersPipelineRuntimeFields<TField extends FormattersPipelineRuntimeField>(
	fieldsById: Readonly<Record<string, TField | undefined>>
): FormattersPipelineRuntimeFields<TField> {
	const runtimeFields: Record<string, Readonly<TField>> = {};

	for (const [fieldId, field] of Object.entries(fieldsById)) {
		if (!field) continue;
		runtimeFields[fieldId] = compileFormattersPipelineRuntime(field);
	}

	return runtimeFields;
}

/**
 * Вычисляет display-result для одного значения без знания о таблице или графике.
 */
export function formatPipelineDisplayValue<TField extends FormattersPipelineRuntimeField>(
	args: FormatPipelineDisplayValueArgs<TField>
): FormattersPipelineDisplayValue {
	if (!args.field) {
		return createDefaultDisplayValue(toSafeString(args.rawValue), false);
	}

	const sourceValue = resolvePipelineSourceValue(args.rawValue, args.rowData, args.field);
	const displayValue = executePipelineFormatting(args, sourceValue.value, args.field);

	return applyDisplayPostProcessing(displayValue, sourceValue, args.field);
}
