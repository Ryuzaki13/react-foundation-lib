import { formatTableFormulaExpression, createTableFormulaRegistry, type TableFormulaDefinition } from "../src/formulas";

// Необязательный шаблон сохраняет контракт опубликованных определений формул.
const existingDefinition: TableFormulaDefinition = {
	id: "sum",
	name: "Сумма",
	description: "Складывает значения двух зависимостей.",
	fn: (context) => context.num(0) + context.num(1)
};
const previewDefinition: TableFormulaDefinition = { ...existingDefinition, id: "sum-preview", expressionTemplate: "$0 + $1" };
const registry = createTableFormulaRegistry([existingDefinition, previewDefinition]);
const expressionTemplate: string | undefined = registry.list[0]?.expressionTemplate;
const formatExpression: (template: string, dependencies: readonly string[]) => string = formatTableFormulaExpression;
const expression: string = formatExpression("$0 + $1", ["FIELD_X", "FIELD_Y"] as const);

void [expressionTemplate, expression];
