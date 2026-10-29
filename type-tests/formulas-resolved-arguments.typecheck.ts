import {
	compileTableFormula,
	compileTableFormulaWithResolvedArguments,
	executeTableFormula,
	executeTableFormulaWithResolvedArguments,
	type TableFormulaCompiledExecutor,
	type TableFormulaDependency,
	type TableFormulaExecutionResult,
	type TableFormulaResolvedArgument,
	type TableFormulaResolvedExecutor
} from "../src/formulas";

const resolvedArguments: readonly TableFormulaResolvedArgument[] = [
	{ value: 20, key: "AMOUNT" },
	{ value: 100 },
	{ value: null },
	{ value: undefined },
	{ value: "25" }
];

const compileResolved: (args: {
	formulaId: string | undefined;
}) => { ok: true; execute: TableFormulaResolvedExecutor } | { ok: false; reason: "formula_not_found" } =
	compileTableFormulaWithResolvedArguments;
const executeResolved: (args: {
	formulaId: string | undefined;
	arguments: readonly TableFormulaResolvedArgument[];
}) => TableFormulaExecutionResult = executeTableFormulaWithResolvedArguments;
const compiled = compileResolved({ formulaId: "ratio" });

if (compiled.ok) {
	const executor: TableFormulaResolvedExecutor = compiled.execute;
	const result: TableFormulaExecutionResult = executor(resolvedArguments);

	void result;
}

executeResolved({ formulaId: "ratio", arguments: resolvedArguments });

// Новый вход не расширяет прежний union: нестроковый dependency остаётся числовой константой.
const readExistingDependency = (dependency: TableFormulaDependency): string | number =>
	typeof dependency === "string" ? dependency : dependency.value;
const existingExecutor: TableFormulaCompiledExecutor = (rowData) => ({ ok: true, value: Number(rowData.AMOUNT) });
const compileExisting: (args: {
	formulaId: string | undefined;
	keys?: readonly TableFormulaDependency[];
}) => { ok: true; execute: TableFormulaCompiledExecutor } | { ok: false; reason: "formula_not_found" } = compileTableFormula;
const executeExisting: (args: {
	formulaId: string | undefined;
	rowData: Record<string, unknown>;
	keys?: readonly TableFormulaDependency[];
}) => TableFormulaExecutionResult = executeTableFormula;

// @ts-expect-error Даже неизвестное значение должно быть передано полем value.
const missingValue: TableFormulaResolvedArgument = { key: "AMOUNT" };
// @ts-expect-error Ключ текущего поля является строкой.
const invalidKey: TableFormulaResolvedArgument = { value: 20, key: 1 };
const readonlyArgument: TableFormulaResolvedArgument = { value: 20, key: "AMOUNT" };

// @ts-expect-error Готовая позиция не изменяется executor или потребителем.
readonlyArgument.value = 30;
// @ts-expect-error Порядок readonly массива не меняется во время выполнения.
resolvedArguments.push({ value: 30 });
// @ts-expect-error Готовые позиции не становятся новым видом сериализуемого dependency.
const resolvedDependency: TableFormulaDependency = { value: 20 };

void [readExistingDependency, existingExecutor, compileExisting, executeExisting, missingValue, invalidKey, resolvedDependency];
