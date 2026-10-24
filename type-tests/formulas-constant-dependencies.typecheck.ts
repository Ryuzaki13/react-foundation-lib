import {
	compileTableFormula,
	createTableFormulaContext,
	executeTableFormula,
	formatTableFormulaExpression,
	validateTableFormulaDependencies,
	type TableFormulaDependency
} from "../src/formulas";
import { type FormattersPipelineRuntimeField } from "../src/formatters";

const dependencies: readonly TableFormulaDependency[] = ["VALUE", { kind: "constant", value: 100 }];
const field: FormattersPipelineRuntimeField = { id: "CALC", role: "measure", type: "decimal", formulaDependencies: dependencies };

createTableFormulaContext({ rowData: {}, keys: dependencies });
compileTableFormula({ formulaId: "ratio", keys: dependencies });
executeTableFormula({ formulaId: "ratio", rowData: {}, keys: dependencies });
validateTableFormulaDependencies({ formulaId: "ratio", dependencies });
formatTableFormulaExpression("$0 / $1", dependencies);

// Расширенный вход сохраняет присваиваемость опубликованного строкового контракта.
const existingCompile: (args: { formulaId: string | undefined; keys?: readonly string[] }) => unknown = compileTableFormula;
const existingExecute: (args: { formulaId: string | undefined; rowData: Record<string, unknown>; keys?: readonly string[] }) => unknown =
	executeTableFormula;

// @ts-expect-error Строковая константа не является числовым literal.
const invalidConstant: TableFormulaDependency = { kind: "constant", value: "100" };

void [field, existingCompile, existingExecute, invalidConstant];
