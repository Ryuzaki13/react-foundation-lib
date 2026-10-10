import { arrayDeduplicate } from "../array";
import { buildTreeTableRows } from "../tree-table";
import { type TreeTableRowNode } from "../tree-table";
import { stableStringify } from "../utils";

import { aggregateAnalyticalValues } from "./aggregation";
import { calculateAnalyticalValues, createAnalyticalCalculationPlan } from "./calculations";
import { matchesAnalyticalFilter } from "./filtering";
import { indexAnalyticalRows } from "./indexAnalyticalRows";
import {
	type AnalyticalDataRow,
	type AnalyticalModelRow,
	type AnalyticalTableModel,
	type AnalyticalValues,
	type BuildAnalyticalTableModelOptions
} from "./types";
import { analyticalIdentity, compareAnalyticalValues } from "./valueComparison";

type PreparedNode<T> = Readonly<{
	id: string;
	kind: "data" | "group";
	sourceRow?: AnalyticalDataRow<T>;
	values: AnalyticalValues;
	children: PreparedNode<T>[];
	groupingLevelId?: string;
}>;

/** Чистая модель полного снимка: не владеет транспортом, кэшем, DOM и жизненным циклом Query. */
export function buildAnalyticalTableModel<T>(options: BuildAnalyticalTableModelOptions<T>): AnalyticalTableModel<T> {
	const { snapshot, columns, state = {} } = options;
	const plan = createAnalyticalCalculationPlan(columns);
	const columnsById = new Map(columns.map((column) => [column.id, column]));
	const grouping = state.grouping ?? [];
	const sorting = state.sorting ?? [];
	const filters = state.filters ?? [];
	for (const id of [...sorting.map((sort) => sort.id), ...filters.map((filter) => filter.id)]) {
		if (!columnsById.has(id)) throw new Error(`Неизвестный аналитический столбец: ${id}`);
	}
	if (arrayDeduplicate(grouping.map((level) => level.id)).length !== grouping.length)
		throw new Error("Идентификаторы уровней группировки должны быть уникальны.");
	for (const level of grouping)
		if (level.keyColumnIds.length === 0) throw new Error(`Уровень ${level.id} не содержит ключей группировки.`);
	const dataRows = snapshot.rows.map((row) => ({ ...row, values: calculateAnalyticalValues(row.values, plan) }));
	if (dataRows.some((row) => row.id.length === 0)) throw new Error("Идентификатор аналитической строки не может быть пустым.");
	const tree = buildTreeTableRows(dataRows, { getRowId: (row) => row.id, getParentRowId: (row) => row.parentId });
	const roots = new Set(tree.rootRowIds);
	const isAggregateRow = options.isAggregateRow ?? ((row: AnalyticalDataRow<T>) => roots.has(row.id));
	const prepare = (node: TreeTableRowNode<AnalyticalDataRow<T>>): PreparedNode<T> => ({
		id: node.id,
		kind: "data",
		sourceRow: tree.rowById.get(node.id),
		values: node.values,
		children: (node.children ?? []).map(prepare)
	});
	const sourceRoots = tree.rows.map(prepare);
	const collectRows = (nodes: readonly PreparedNode<T>[]): AnalyticalDataRow<T>[] => {
		const rows: AnalyticalDataRow<T>[] = [];
		const visit = (node: PreparedNode<T>): void => {
			if (node.sourceRow && isAggregateRow(node.sourceRow)) rows.push(node.sourceRow);
			for (const child of node.children) visit(child);
		};
		for (const node of nodes) visit(node);
		return rows;
	};
	const aggregate = (nodes: readonly PreparedNode<T>[], scope: "group" | "grand", path: AnalyticalValues): AnalyticalValues => {
		const context = { scope, rows: collectRows(nodes), groupingPath: path };
		const values: Record<string, unknown> = { ...path };
		for (const column of columns) {
			if (!column.aggregate) continue;
			values[column.id] =
				typeof column.aggregate === "function"
					? column.aggregate(context)
					: aggregateAnalyticalValues(
							context.rows.map((row) => row.values[column.id]),
							column.aggregate
						);
		}
		Object.assign(values, options.aggregate?.(context));
		// Готовый итог колонки и значения пути имеют приоритет над её построчной
		// формулой. Зависимые формулы при этом читают уже выбранный итог: например,
		// сумма произведений не превращается в произведение сумм, а ratio без
		// собственного aggregate по-прежнему вычисляется из сумм числителя и знаменателя.
		const totalsPlan = { ...plan, steps: plan.steps.filter((step) => !Object.hasOwn(values, step.columnId)) };
		return calculateAnalyticalValues(values, totalsPlan);
	};
	// Совпадение родителя сохраняет его ветвь целиком; совпадение ребёнка сохраняет путь к нему.
	const filterNodes = (nodes: readonly PreparedNode<T>[]): PreparedNode<T>[] =>
		nodes.flatMap((node) => {
			const sourceRow = node.sourceRow;
			if (sourceRow && filters.every((filter) => matchesAnalyticalFilter(sourceRow, filter, columnsById.get(filter.id))))
				return [node];
			const children = filterNodes(node.children);
			return children.length > 0 ? [{ ...node, children }] : [];
		});
	const filteredRoots = filters.length > 0 ? filterNodes(sourceRoots) : sourceRoots;
	const groupNodes = (
		nodes: PreparedNode<T>[],
		levelIndex: number,
		path: AnalyticalValues,
		identityPath: readonly string[]
	): PreparedNode<T>[] => {
		const level = grouping[levelIndex];
		if (!level) return nodes;
		const buckets = new Map<string, PreparedNode<T>[]>();
		for (const node of nodes) {
			const key = analyticalIdentity(node.values, level.keyColumnIds);
			const bucket = buckets.get(key);
			if (bucket) bucket.push(node);
			else buckets.set(key, [node]);
		}
		return Array.from(buckets, ([key, members]) => {
			const identity = [...identityPath, level.id, key];
			const id = `analytical-group:${stableStringify(identity)}`;
			if (tree.rowById.has(id)) throw new Error(`Идентификатор исходной строки совпал с группой: ${id}`);
			const nextPath: Record<string, unknown> = { ...path };
			for (const columnId of [...level.keyColumnIds, ...(level.displayColumnIds ?? [])])
				nextPath[columnId] = members[0].values[columnId];
			return {
				id,
				kind: "group",
				groupingLevelId: level.id,
				values: aggregate(members, "group", nextPath),
				children: groupNodes(members, levelIndex + 1, nextPath, identity)
			};
		});
	};
	const prepared = groupNodes(filteredRoots, 0, {}, []);
	const expanded = new Set(state.expandedRowIds === "all" ? [] : (state.expandedRowIds ?? []));
	const sortNodes = (nodes: readonly PreparedNode<T>[]): PreparedNode<T>[] =>
		[...nodes].sort((left, right) => {
			for (const sort of sorting) {
				const comparison = compareAnalyticalValues(left.values[sort.id], right.values[sort.id], columnsById.get(sort.id));
				if (comparison !== 0) return sort.desc ? -comparison : comparison;
			}
			return 0;
		});
	const materialize = (nodes: readonly PreparedNode<T>[], parentId: string | null, level: number): AnalyticalModelRow<T>[] =>
		sortNodes(nodes).map((node) => ({
			id: node.id,
			parentId,
			kind: node.kind,
			sourceRow: node.sourceRow,
			original: node.sourceRow?.original,
			values: node.values,
			level,
			children: materialize(node.children, node.id, level + 1),
			isExpandable: node.children.length > 0,
			isExpanded: node.children.length > 0 && (state.expandedRowIds === "all" || expanded.has(node.id)),
			groupingLevelId: node.groupingLevelId
		}));
	const rows = materialize(prepared, null, 0);
	return {
		columns,
		rows,
		...indexAnalyticalRows(rows),
		grandTotals:
			options.grandTotals === false ? null : aggregate(options.grandTotalsScope === "all" ? sourceRoots : filteredRoots, "grand", {}),
		diagnostics: { orphanRowIds: tree.orphanRowIds, duplicateRowIds: tree.duplicateRowIds, cyclicRowIds: tree.cyclicRowIds }
	};
}
