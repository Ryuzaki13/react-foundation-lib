import { calculateAnalyticalValues } from "../definition/calculations";
import { type AnalyticalAggregateContext, type CompiledAnalyticalTableDefinition } from "../definition/types";

import { aggregateAnalyticalValues } from "./aggregation";
import { type AnalyticalHierarchyNode } from "./hierarchy";
import { type AnalyticalDataRow, type AnalyticalValues } from "./types";

/** Отбирает исходные строки выбранной зернистости; синтетические группы в итоги не попадают. */
function collectAggregateRows<T>(
	nodes: readonly AnalyticalHierarchyNode<T>[],
	aggregateRowIds: ReadonlySet<string>
): AnalyticalDataRow<T>[] {
	const rows: AnalyticalDataRow<T>[] = [];
	const visit = (node: AnalyticalHierarchyNode<T>): void => {
		if (node.sourceRow && aggregateRowIds.has(node.id)) {
			rows.push(node.sourceRow);
		}

		for (const child of node.children) {
			visit(child);
		}
	};

	for (const node of nodes) {
		visit(node);
	}

	return rows;
}

/** Один порядок для групповых и общих итогов: агрегации → callback → зависимые формулы. */
export function calculateAnalyticalTotals<T>(args: {
	definition: CompiledAnalyticalTableDefinition<T>;
	nodes: readonly AnalyticalHierarchyNode<T>[];
	aggregateRowIds: ReadonlySet<string>;
	scope: "group" | "grand";
	groupingPath?: AnalyticalValues;
}): AnalyticalValues {
	const { definition, nodes, aggregateRowIds, scope, groupingPath = {} } = args;
	const context: AnalyticalAggregateContext<T> = {
		scope,
		rows: collectAggregateRows(nodes, aggregateRowIds),
		groupingPath
	};
	const values: Record<string, unknown> = { ...groupingPath };

	for (const field of definition.aggregateFields) {
		const aggregate = field.aggregate;
		if (aggregate === undefined) continue;

		values[field.id] =
			typeof aggregate === "function"
				? aggregate(context)
				: aggregateAnalyticalValues(
						context.rows.map((row) => row.values[field.id]),
						aggregate
					);
	}

	Object.assign(values, definition.aggregate?.(context));

	// Явные итоги и ключи пути сохраняются. Остальные формулы читают уже готовые
	// суммы: процент считается из сумм, а сумма произведений не заменяется произведением сумм.
	const calculations = {
		...definition.calculations,
		steps: definition.calculations.steps.filter((step) => !Object.hasOwn(values, step.columnId))
	};

	return calculateAnalyticalValues(values, calculations);
}
