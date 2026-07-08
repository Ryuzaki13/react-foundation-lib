import { describe, expect, it } from "vitest";

import { compileFormattersPipelineExecutor } from "./execute";

describe("table column formatters pipeline execute", () => {
	it("применяет rowBasedOverride + resolveValueState + typedValueFormat", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupOverride",
							type: "rowBasedOverride",
							config: {
								mode: "field",
								fieldKey: "COUNT"
							}
						},
						{
							id: "state",
							type: "resolveValueState",
							config: {
								resolver: {
									kind: "threshold",
									thresholds: [10],
									states: ["warning", "success"]
								},
								icon: {
									enabled: true,
									showValue: true,
									position: "right"
								}
							}
						},
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								numberPresetName: "integer"
							}
						}
					]
				}
			},
			column: {
				role: "measure",
				type: "decimal"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const groupResult = compiled.executor.execute({
			value: 5,
			rowData: { COUNT: 12 },
			rowKind: "group",
			isGroupRow: true,
			isTotalsRow: false,
			rowLevel: 0,
			groupingIds: ["DIM"],
			columnId: "MEASURE"
		});

		expect(groupResult.value).toBe("12");
		expect(groupResult.state).toBe("success");
		expect(groupResult.icon).toBe("success");
		expect(groupResult.iconPosition).toBe("right");
	});

	it("применяет compact-пресет в typedValueFormat", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "typed",
							type: "typedValueFormat",
							config: {
								numberPresetName: "compact-currency"
							}
						}
					]
				}
			},
			column: {
				role: "measure",
				type: "decimal"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: 34823,
			rowData: {},
			rowKind: "plain",
			isGroupRow: false,
			isTotalsRow: false,
			rowLevel: 0,
			groupingIds: [],
			columnId: "MEASURE"
		});

		expect(result.value).toBe("34 тыс");
	});

	it("применяет rowBasedOverride(field) для plain-строки generic-таблицы", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupOverride",
							type: "rowBasedOverride",
							config: {
								mode: "field",
								fieldKey: "LABEL"
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: "RAW",
			rowData: { LABEL: "PLAIN_LABEL" },
			rowKind: "plain",
			isGroupRow: false,
			isTotalsRow: false,
			rowLevel: 0,
			groupingIds: [],
			columnId: "LABEL"
		});

		expect(result.value).toBe("PLAIN_LABEL");
	});

	it("применяет rowBasedOverride(field) для tree-строки generic-таблицы", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupOverride",
							type: "rowBasedOverride",
							config: {
								mode: "field",
								fieldKey: "LABEL"
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: "RAW",
			rowData: { LABEL: "TREE_LABEL" },
			rowKind: "tree",
			isGroupRow: false,
			isTotalsRow: false,
			rowLevel: 2,
			groupingIds: [],
			columnId: "LABEL"
		});

		expect(result.value).toBe("TREE_LABEL");
	});

	it("применяет rowBasedOverride(formula) для plain-строки и передаёт rowData", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupFormula",
							type: "rowBasedOverride",
							config: {
								mode: "formula",
								formulaId: "valueWhenFieldOrNull",
								dependencyIds: ["FLAG"]
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: "RAW",
			rowData: { FLAG: 1 },
			rowKind: "plain",
			isGroupRow: false,
			isTotalsRow: false,
			rowLevel: 0,
			groupingIds: [],
			columnId: "LABEL"
		});

		expect(result.value).toBe("RAW");
	});

	it("передаёт dependencyIds в rowBasedOverride(formula) как индексный контекст", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupFormula",
							type: "rowBasedOverride",
							config: {
								mode: "formula",
								formulaId: "divideWhenFieldOrNull",
								dependencyIds: ["A", "B", "C"]
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: 1,
			rowData: { A: 10, B: 4, C: 2 },
			rowKind: "plain",
			isGroupRow: false,
			isTotalsRow: false,
			rowLevel: 0,
			groupingIds: [],
			columnId: "LABEL"
		});

		expect(result.value).toBe(8);
	});

	it("не компилирует pipeline с неизвестной groupRow формулой", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupFormula",
							type: "rowBasedOverride",
							config: {
								mode: "formula",
								formulaId: "missingFormula"
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled).toEqual({
			ok: false,
			reason: "row_based_formula_not_found"
		});
	});

	it("использует typed форматирование дат по умолчанию", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [{ id: "typed", type: "typedValueFormat" }]
				}
			},
			column: {
				role: "dimension",
				type: "datetime"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: "2026-02-01T00:00:00.000Z",
			rowData: {},
			rowKind: "plain",
			isGroupRow: false,
			isTotalsRow: false,
			rowLevel: 0,
			groupingIds: [],
			columnId: "DATE_COL"
		});

		expect(typeof result.value).toBe("string");
		expect(result.hasTypedValueFormat).toBe(true);
		expect(result.state).toBe("none");
	});

	it("не применяет rowBasedOverride(field) для totals-строки", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupOverride",
							type: "rowBasedOverride",
							config: {
								mode: "field",
								fieldKey: "LABEL"
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: "RAW",
			rowData: { LABEL: "TOTALS_LABEL" },
			rowKind: "totals",
			isGroupRow: false,
			isTotalsRow: true,
			rowLevel: 0,
			groupingIds: [],
			columnId: "LABEL"
		});

		expect(result.value).toBe("RAW");
	});

	it("применяет rowBasedOverride(formula) для totals-строки", () => {
		const compiled = compileFormattersPipelineExecutor({
			config: {
				version: 1,
				plan: {
					steps: [
						{
							id: "groupFormula",
							type: "rowBasedOverride",
							config: {
								mode: "formula",
								formulaId: "valueWhenFieldOrNull",
								dependencyIds: ["FLAG"]
							}
						}
					]
				}
			},
			column: {
				role: "dimension",
				type: "string"
			}
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const result = compiled.executor.execute({
			value: "RAW",
			rowData: { FLAG: 1 },
			rowKind: "totals",
			isGroupRow: false,
			isTotalsRow: true,
			rowLevel: 0,
			groupingIds: [],
			columnId: "LABEL"
		});

		expect(result.value).toBe("RAW");
	});
});
