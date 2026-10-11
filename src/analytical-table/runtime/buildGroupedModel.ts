import { type AnalyticalGroupingLevel, type CompiledAnalyticalTableDefinition } from "../definition/types";
import { indexAnalyticalRows } from "../projections/indexAnalyticalRows";

import { groupAnalyticalHierarchy } from "./grouping";
import { type AnalyticalHierarchyNode, type AnalyticalSourceHierarchy } from "./hierarchy";
import { calculateAnalyticalTotals } from "./totals";
import { type AnalyticalModelRow, type AnalyticalTableModel } from "./types";

/** Назначает конечные уровни и родителей после добавления всех группировок. */
function materializeRows<T>(
	nodes: readonly AnalyticalHierarchyNode<T>[],
	parentId: string | null = null,
	level = 0
): AnalyticalModelRow<T>[] {
	return nodes.map((node) => ({
		id: node.id,
		parentId,
		kind: node.kind,
		sourceRow: node.sourceRow,
		original: node.sourceRow?.original,
		values: node.values,
		level,
		children: materializeRows(node.children, node.id, level + 1),
		isExpandable: node.children.length > 0,
		isExpanded: false,
		groupingLevelId: node.groupingLevelId
	}));
}

/** Базовая модель содержит все отобранные строки и итоги; порядок и раскрытие задаются позже. */
export function buildGroupedAnalyticalModel<T>(args: {
	definition: CompiledAnalyticalTableDefinition<T>;
	source: AnalyticalSourceHierarchy<T>;
	filteredRows: readonly AnalyticalHierarchyNode<T>[];
	grouping: readonly AnalyticalGroupingLevel[];
}): AnalyticalTableModel<T> {
	const { definition, source, filteredRows, grouping } = args;
	const hierarchy = groupAnalyticalHierarchy({ rows: filteredRows, grouping, definition, source });
	const rows = materializeRows(hierarchy);
	const grandTotals = definition.grandTotals
		? calculateAnalyticalTotals({
				definition,
				nodes: definition.grandTotalsScope === "all" ? source.rows : filteredRows,
				aggregateRowIds: source.aggregateRowIds,
				scope: "grand"
			})
		: null;

	return {
		columns: definition.columns,
		rows,
		...indexAnalyticalRows(rows),
		grandTotals,
		diagnostics: source.diagnostics
	};
}
