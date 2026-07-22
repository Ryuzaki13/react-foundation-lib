import { beforeEach, describe, expect, it } from "vitest";

import { configureTableFormulaRegistry, createTableFormulaRegistry } from "../../formulas";

import { formatTypedCellValue } from "./execute";
import { compileFormattersPipelineRuntime, compileFormattersPipelineRuntimeFields, formatPipelineDisplayValue } from "./runtime";

import type { FormattersPipelineRuntimeField } from "./types";

beforeEach(() => {
	configureTableFormulaRegistry(
		createTableFormulaRegistry([
			{
				id: "sum",
				name: "Сумма",
				description: "Складывает два значения.",
				fn: (context) => context.num(0) + context.num(1)
			}
		])
	);
});

function measureField(id: string, overrides?: Partial<FormattersPipelineRuntimeField>): FormattersPipelineRuntimeField {
	return {
		id,
		role: "measure",
		type: "decimal",
		...overrides
	};
}

function dimensionField(id: string, overrides?: Partial<FormattersPipelineRuntimeField>): FormattersPipelineRuntimeField {
	return {
		id,
		role: "dimension",
		type: "string",
		...overrides
	};
}

describe("compileFormattersPipelineRuntime", () => {
	it("компилирует formula runtime для поля с валидной формулой и сохраняет identity", () => {
		const field = measureField("MARKUP", {
			formulaId: "sum",
			formulaDependencies: ["MP_BC", "NETWR"]
		});
		const compiled = compileFormattersPipelineRuntime(field);

		expect(compiled).toBe(field);
		expect(compiled.formulaExecutor).toBeTypeOf("function");
	});

	it("ставит безопасный formula executor, если формула не найдена", () => {
		const field = compileFormattersPipelineRuntime(
			measureField("MARKUP", {
				formulaId: "missing_formula",
				formulaDependencies: ["A", "B"]
			})
		);

		expect(field.formulaExecutor?.({ A: 1, B: 2 })).toEqual({
			ok: false,
			reason: "formula_not_found"
		});
	});

	it("компилирует pipeline с rowBasedOverride для generic-потребителей", () => {
		const field = compileFormattersPipelineRuntime(
			dimensionField("STATUS", {
				formattersPipeline: {
					version: 1,
					plan: {
						steps: [
							{
								id: "groupStep",
								type: "rowBasedOverride",
								config: {
									mode: "field",
									fieldKey: "STATUS"
								}
							}
						]
					}
				}
			})
		);

		expect(field.formattersPipelineExecutor).toBeTypeOf("object");
	});

	it("компилирует runtime один раз на снимок полей и переиспользует executors при форматировании", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			MARKUP: measureField("MARKUP", {
				formulaId: "sum",
				formulaDependencies: ["MP_BC", "NETWR"]
			})
		});

		const formulaExecutor = runtime.MARKUP?.formulaExecutor;
		expect(formulaExecutor).toBeTypeOf("function");

		const firstCell = formatPipelineDisplayValue({
			field: runtime.MARKUP,
			rawValue: undefined,
			rowData: {
				MP_BC: 100,
				NETWR: 160
			},
			rowKind: "plain"
		});
		const secondCell = formatPipelineDisplayValue({
			field: runtime.MARKUP,
			rawValue: undefined,
			rowData: {
				MP_BC: 80,
				NETWR: 100
			},
			rowKind: "plain"
		});

		expect(runtime.MARKUP?.formulaExecutor).toBe(formulaExecutor);
		expect(firstCell.value).not.toBe("");
		expect(secondCell.value).not.toBe("");
	});
});

describe("formatPipelineDisplayValue", () => {
	it("возвращает пустое значение для purely-derived поля при ошибке формулы", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			MARKUP: measureField("MARKUP", {
				formulaId: "missing_formula",
				formulaDependencies: ["A", "B"],
				purelyDerived: true
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.MARKUP,
			rawValue: 123,
			rowData: {
				A: 1,
				B: 2
			},
			rowKind: "plain"
		});

		expect(cell).toEqual({
			value: "",
			state: "none",
			showIcon: false,
			showValue: true,
			iconPosition: "left",
			overflowTooltip: false
		});
	});

	it("сохраняет raw value при ошибке формулы, если поле не purely-derived", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			MARKUP: measureField("MARKUP", {
				formulaId: "missing_formula",
				formulaDependencies: ["A", "B"]
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.MARKUP,
			rawValue: 123,
			rowData: {
				A: 1,
				B: 2
			},
			rowKind: "plain"
		});

		expect(cell).toEqual({
			value: formatTypedCellValue(123, { role: "measure", type: "decimal" }),
			state: "none",
			showIcon: false,
			showValue: true,
			iconPosition: "left",
			overflowTooltip: false
		});
	});

	it("использует typed fallback для measure, datetime и string", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			AMOUNT: measureField("AMOUNT"),
			DATE: dimensionField("DATE", {
				type: "datetime"
			}),
			STATUS: dimensionField("STATUS")
		});

		const amountCell = formatPipelineDisplayValue({
			field: runtime.AMOUNT,
			rawValue: 1234.5,
			rowData: {},
			rowKind: "plain"
		});
		const dateCell = formatPipelineDisplayValue({
			field: runtime.DATE,
			rawValue: "2026-03-18T00:00:00.000Z",
			rowData: {},
			rowKind: "plain"
		});
		const statusCell = formatPipelineDisplayValue({
			field: runtime.STATUS,
			rawValue: "OK",
			rowData: {},
			rowKind: "plain"
		});

		expect(amountCell.value).toBe(formatTypedCellValue(1234.5, { role: "measure", type: "decimal" }));
		expect(dateCell.value).toBe(formatTypedCellValue("2026-03-18T00:00:00.000Z", { role: "dimension", type: "datetime" }));
		expect(statusCell.value).toBe("OK");
	});

	it("применяет pipeline с resolveValueState и typedValueFormat", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			STATUS: measureField("STATUS", {
				formattersPipeline: {
					version: 1,
					plan: {
						steps: [
							{
								id: "stateStep",
								type: "resolveValueState",
								config: {
									resolver: {
										kind: "threshold",
										thresholds: [100],
										states: ["success", "warning"],
										invalidState: "none"
									},
									icon: {
										enabled: true,
										showValue: true,
										position: "right"
									}
								}
							},
							{
								id: "formatStep",
								type: "typedValueFormat"
							}
						]
					}
				},
				overflowTooltip: true
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.STATUS,
			rawValue: 150,
			rowData: {
				STATUS: 150
			},
			rowKind: "plain"
		});

		expect(cell).toEqual({
			value: formatTypedCellValue(150, { role: "measure", type: "decimal" }),
			state: "warning",
			icon: "warning",
			showIcon: true,
			showValue: true,
			iconPosition: "right",
			overflowTooltip: true
		});
	});

	it("скрывает нулевое значение при emptyWhenZero", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			AMOUNT: measureField("AMOUNT", {
				emptyWhenZero: true
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.AMOUNT,
			rawValue: 0,
			rowData: {},
			rowKind: "plain"
		});

		expect(cell).toEqual({
			value: "",
			state: "none",
			showIcon: false,
			showValue: true,
			iconPosition: "left",
			overflowTooltip: false
		});
	});

	it("не скрывает ненулевое значение при emptyWhenZero", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			AMOUNT: measureField("AMOUNT", {
				emptyWhenZero: true
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.AMOUNT,
			rawValue: 42,
			rowData: {},
			rowKind: "plain"
		});

		expect(cell).toEqual({
			value: formatTypedCellValue(42, { role: "measure", type: "decimal" }),
			state: "none",
			showIcon: false,
			showValue: true,
			iconPosition: "left",
			overflowTooltip: false
		});
	});

	it("применяет rowBasedOverride(field) для plain-строки generic-потребителя", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			STATUS: dimensionField("STATUS", {
				formattersPipeline: {
					version: 1,
					plan: {
						steps: [
							{
								id: "groupStep",
								type: "rowBasedOverride",
								config: {
									mode: "field",
									fieldKey: "STATUS_LABEL"
								}
							}
						]
					}
				}
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.STATUS,
			rawValue: "RAW",
			rowData: {
				STATUS_LABEL: "PLAIN_LABEL"
			},
			rowKind: "plain"
		});

		expect(cell).toEqual({
			value: "PLAIN_LABEL",
			state: "none",
			showIcon: false,
			showValue: true,
			iconPosition: "left",
			overflowTooltip: false
		});
	});

	it("не применяет rowBasedOverride для totals-контекста", () => {
		const runtime = compileFormattersPipelineRuntimeFields({
			STATUS: dimensionField("STATUS", {
				formattersPipeline: {
					version: 1,
					plan: {
						steps: [
							{
								id: "groupStep",
								type: "rowBasedOverride",
								config: {
									mode: "field",
									fieldKey: "STATUS_LABEL"
								}
							}
						]
					}
				}
			})
		});

		const cell = formatPipelineDisplayValue({
			field: runtime.STATUS,
			rawValue: "RAW",
			rowData: {
				STATUS_LABEL: "TOTALS_LABEL"
			},
			rowKind: "totals"
		});

		expect(cell).toEqual({
			value: "RAW",
			state: "none",
			showIcon: false,
			showValue: true,
			iconPosition: "left",
			overflowTooltip: false
		});
	});
});
