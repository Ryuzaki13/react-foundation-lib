import type { TreeTableBuildResult, TreeTableFlatHierarchy, TreeTableRowNode } from "./types";

/**
 * Добавляет дочерний идентификатор в индекс родителей.
 */
function appendChildId(childIdsByParent: Map<string, string[]>, parentId: string, childId: string) {
	const currentChildIds = childIdsByParent.get(parentId);

	if (currentChildIds) {
		currentChildIds.push(childId);
		return;
	}

	childIdsByParent.set(parentId, [childId]);
}

/**
 * Удаляет дубли идентификаторов, сохраняя исходный порядок.
 */
function dedupeIds(ids: readonly string[]): string[] {
	return Array.from(new Set(ids));
}

/**
 * Строит древовидную структуру из плоского списка OData-строк.
 *
 * Алгоритм устойчив к "сиротам", самоссылкам и циклам:
 * проблемные строки не теряются, а поднимаются в корень леса.
 */
export function buildTreeTableRows<TData extends object>(
	items: readonly TData[],
	hierarchy: TreeTableFlatHierarchy<TData>
): TreeTableBuildResult<TData> {
	const rowById = new Map<string, TData>();
	const parentById = new Map<string, string | null>();
	const childIdsByParent = new Map<string, string[]>();
	const duplicateRowIds: string[] = [];
	const orphanRowIds: string[] = [];
	const cyclicRowIds: string[] = [];
	const allRowIds: string[] = [];

	// Сначала собираем справочники, чтобы порядок в источнике не влиял на корректность дерева.
	for (const item of items) {
		const rowId = hierarchy.getRowId(item);

		if (rowById.has(rowId)) {
			duplicateRowIds.push(rowId);
			continue;
		}

		const parentRowId = hierarchy.getParentRowId(item) ?? null;

		rowById.set(rowId, item);
		parentById.set(rowId, parentRowId);
		allRowIds.push(rowId);

		if (parentRowId !== null && parentRowId !== rowId) {
			appendChildId(childIdsByParent, parentRowId, rowId);
		}
	}

	const rootCandidates: string[] = [];

	// Нормализуем корни: явные корни, сироты и самоссылки отображаем как корневые строки.
	for (const rowId of allRowIds) {
		const parentRowId = parentById.get(rowId) ?? null;

		if (parentRowId === null) {
			rootCandidates.push(rowId);
			continue;
		}

		if (parentRowId === rowId) {
			cyclicRowIds.push(rowId);
			rootCandidates.push(rowId);
			continue;
		}

		if (!rowById.has(parentRowId)) {
			orphanRowIds.push(rowId);
			rootCandidates.push(rowId);
		}
	}

	const visitedRowIds = new Set<string>();

	/**
	 * Рекурсивно собирает вложенный узел, отсекая уже посещённые идентификаторы.
	 */
	const buildNode = (rowId: string, ancestors: Set<string>): TreeTableRowNode<TData> => {
		const originalRow = rowById.get(rowId);

		if (!originalRow) {
			throw new Error(`Не удалось построить дерево: строка "${rowId}" отсутствует в индексе.`);
		}

		visitedRowIds.add(rowId);

		const nextAncestors = new Set(ancestors);
		nextAncestors.add(rowId);

		const node = { ...originalRow } as TreeTableRowNode<TData>;
		const childIds = childIdsByParent.get(rowId) ?? [];
		const children: TreeTableRowNode<TData>[] = [];

		for (const childId of childIds) {
			if (nextAncestors.has(childId)) {
				cyclicRowIds.push(childId);
				continue;
			}

			if (visitedRowIds.has(childId)) {
				continue;
			}

			children.push(buildNode(childId, nextAncestors));
		}

		if (children.length > 0) {
			node.children = children;
		}

		return node;
	};

	const rows: TreeTableRowNode<TData>[] = [];
	const resolvedRootRowIds: string[] = [];

	for (const rootRowId of rootCandidates) {
		if (visitedRowIds.has(rootRowId)) {
			continue;
		}

		rows.push(buildNode(rootRowId, new Set<string>()));
		resolvedRootRowIds.push(rootRowId);
	}

	// Если корней нет из-за цикла, всё равно выводим строки, начиная с первого непосещённого узла.
	for (const rowId of allRowIds) {
		if (visitedRowIds.has(rowId)) {
			continue;
		}

		cyclicRowIds.push(rowId);
		rows.push(buildNode(rowId, new Set<string>()));
		resolvedRootRowIds.push(rowId);
	}

	return {
		rows,
		rowById,
		allRowIds,
		rootRowIds: dedupeIds(resolvedRootRowIds),
		orphanRowIds: dedupeIds(orphanRowIds),
		duplicateRowIds: dedupeIds(duplicateRowIds),
		cyclicRowIds: dedupeIds(cyclicRowIds)
	};
}
