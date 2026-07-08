import { normalizeObjects } from "../array";

import {
	TREE_TABLE_TRANSPOSED_LABEL_FIELD,
	TREE_TABLE_TRANSPOSED_LEVEL_FIELD,
	TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD,
	TREE_TABLE_TRANSPOSED_ROW_ID_FIELD,
	TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD,
	TreeTableTransposeFlatRowsLevel,
	type TreeTableTransposeFlatRowsOptions,
	type TreeTableTransposedRow
} from "./types";

type NormalizedHierarchyLevel = {
	columnId: string;
};

type TreePathSegment = readonly [columnId: string, key: string];

function normalizeHierarchyLevels(levels: readonly TreeTableTransposeFlatRowsLevel[]): NormalizedHierarchyLevel[] {
	// const out: NormalizedHierarchyLevel[] = [];
	// const seenColumnIds = new Set<string>();

	// for (const level of levels) {
	// 	const columnId = level.columnId.trim();
	// 	if (!columnId || seenColumnIds.has(columnId)) continue;

	// 	out.push({ columnId });
	// 	seenColumnIds.add(columnId);
	// }

	// return out;

	return (
		normalizeObjects<TreeTableTransposeFlatRowsLevel, "columnId", NormalizedHierarchyLevel>(levels, "columnId", ({ columnId }) => ({
			columnId
		})) ?? []
	);
}

// SHARE: где-то уже была такая проверка... lib/validators/string
function isEmptyTreeValue(value: unknown): boolean {
	return value === null || value === undefined || value === "";
}

// SHARE: lib/formatters/string.toSafeString
function stringifyTreeValue(value: unknown): string {
	return isEmptyTreeValue(value) ? "" : String(value);
}

function createTreeNodeId(path: readonly TreePathSegment[]): string {
	return JSON.stringify(path);
}

function createLeafRowId(path: readonly TreePathSegment[], rowIndex: number): string {
	return `${createTreeNodeId(path)}#row:${rowIndex}`;
}

function createTreePathSegment(level: NormalizedHierarchyLevel, label: string): TreePathSegment {
	return [level.columnId, label];
}

/**
 * Транспонирует плоские backend-строки в flat hierarchy для TreeTable.
 *
 * Backend обычно возвращает строки фактов с колонками уровней (`TEXT_DIVISION`, `TEXT_NODE`).
 * TreeTable же ожидает строки с id/parent-id. Этот helper всегда создает
 * синтетические group-узлы для уровней и оставляет исходные backend-строки
 * листьями, не перезаписывая их бизнес-поля.
 */
export function transposeFlatRowsToTreeTableRows<TData extends Record<string, unknown>>(
	rows: readonly TData[],
	options: TreeTableTransposeFlatRowsOptions
): TreeTableTransposedRow<TData>[] {
	const hierarchyLevels = normalizeHierarchyLevels(options.hierarchyLevels);
	if (hierarchyLevels.length === 0) return [];

	const out: TreeTableTransposedRow<TData>[] = [];
	const syntheticNodeIds = new Set<string>();

	rows.forEach((row, rowIndex) => {
		const path: TreePathSegment[] = [];
		let parentRowId: string | null = null;
		let lastLabel = "";
		let lastLevel = -1;

		for (let levelIndex = 0; levelIndex < hierarchyLevels.length; levelIndex += 1) {
			const level = hierarchyLevels[levelIndex]!;
			const label = stringifyTreeValue(row[level.columnId]);
			if (!label) continue;

			path.push(createTreePathSegment(level, label));
			lastLabel = label;
			lastLevel = levelIndex;

			const nodeId = createTreeNodeId(path);

			if (!syntheticNodeIds.has(nodeId)) {
				const syntheticRow = {
					[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]: nodeId,
					[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]: parentRowId,
					[TREE_TABLE_TRANSPOSED_LABEL_FIELD]: label,
					[TREE_TABLE_TRANSPOSED_LEVEL_FIELD]: levelIndex,
					[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD]: true,
					[level.columnId]: row[level.columnId]
				} satisfies TreeTableTransposedRow<Record<string, unknown>>;

				out.push(syntheticRow as TreeTableTransposedRow<TData>);
				syntheticNodeIds.add(nodeId);
			}

			parentRowId = nodeId;
		}

		if (path.length === 0) return;

		out.push({
			...row,
			[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]: createLeafRowId(path, rowIndex),
			[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]: parentRowId,
			[TREE_TABLE_TRANSPOSED_LABEL_FIELD]: lastLabel,
			[TREE_TABLE_TRANSPOSED_LEVEL_FIELD]: lastLevel + 1,
			[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD]: false
		});
	});

	return out;
}
