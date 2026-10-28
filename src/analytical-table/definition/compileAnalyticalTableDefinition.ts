import { ANALYTICAL_TOTALS_SCOPE_FILTERED } from "./analyticalDefinitionConstants";
import { createAnalyticalCalculationPlan } from "./calculations";
import { type AnalyticalTableDefinition, type CompiledAnalyticalTableDefinition } from "./types";

/** Проверяет единый каталог полей, включая служебные зависимости невидимых вычислений. */
export function compileAnalyticalTableDefinition<T>(definition: AnalyticalTableDefinition<T>): CompiledAnalyticalTableDefinition<T> {
	const fields = [...definition.columns, ...(definition.dataFields ?? [])];
	const calculations = createAnalyticalCalculationPlan(fields);

	return {
		columns: definition.columns,
		fieldsById: new Map(fields.map((field) => [field.id, field])),
		calculations,
		aggregateFields: fields.filter((field) => field.aggregate !== undefined),
		isAggregateRow: definition.isAggregateRow,
		aggregate: definition.aggregate,
		grandTotals: definition.grandTotals !== false,
		grandTotalsScope: definition.grandTotalsScope ?? ANALYTICAL_TOTALS_SCOPE_FILTERED
	};
}
