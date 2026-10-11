import { buildTreeTableRows, type TreeTableRowNode } from "../../tree-table";
import { calculateAnalyticalValues } from "../definition/calculations";
import { type CompiledAnalyticalTableDefinition } from "../definition/types";

import { type AnalyticalDataRow, type AnalyticalDiagnostics, type AnalyticalSnapshot, type AnalyticalValues } from "./types";

/** Узел до назначения итогового parentId/level: группировка ещё может добавить предков. */
export type AnalyticalHierarchyNode<T> = Readonly<{
	id: string;
	kind: "data" | "group";
	sourceRow?: AnalyticalDataRow<T>;
	values: AnalyticalValues;
	children: readonly AnalyticalHierarchyNode<T>[];
	groupingLevelId?: string;
}>;

export type AnalyticalSourceHierarchy<T> = Readonly<{
	rows: readonly AnalyticalHierarchyNode<T>[];
	sourceRowIds: ReadonlySet<string>;
	aggregateRowIds: ReadonlySet<string>;
	diagnostics: AnalyticalDiagnostics;
}>;

/** Формулы исходных строк и предметная иерархия зависят только от определения и снимка. */
export function prepareAnalyticalHierarchy<T>(
	snapshot: AnalyticalSnapshot<T>,
	definition: CompiledAnalyticalTableDefinition<T>
): AnalyticalSourceHierarchy<T> {
	if (snapshot.rows.some((row) => row.id.length === 0)) {
		throw new Error("Идентификатор аналитической строки не может быть пустым.");
	}

	const calculatedRows = snapshot.rows.map((row) => ({
		...row,
		values: calculateAnalyticalValues(row.values, definition.calculations)
	}));
	const tree = buildTreeTableRows(calculatedRows, {
		getRowId: (row) => row.id,
		getParentRowId: (row) => row.parentId
	});

	const prepareNode = (node: TreeTableRowNode<AnalyticalDataRow<T>>): AnalyticalHierarchyNode<T> => ({
		id: node.id,
		kind: "data",
		sourceRow: tree.rowById.get(node.id),
		values: node.values,
		children: (node.children ?? []).map(prepareNode)
	});
	const aggregateRowIds = definition.isAggregateRow
		? Array.from(tree.rowById.values())
				.filter(definition.isAggregateRow)
				.map((row) => row.id)
		: tree.rootRowIds;

	return {
		rows: tree.rows.map(prepareNode),
		sourceRowIds: new Set(tree.allRowIds),
		aggregateRowIds: new Set(aggregateRowIds),
		diagnostics: {
			orphanRowIds: tree.orphanRowIds,
			duplicateRowIds: tree.duplicateRowIds,
			cyclicRowIds: tree.cyclicRowIds
		}
	};
}
