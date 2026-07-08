import { arraysEqual } from "../array";

export type ReorderTableHeaderColumnsArgs = {
	order: readonly string[];
	headerIds: readonly string[];
	lockedIds?: readonly string[];
	pinnedIds?: readonly string[];
	activeId: string;
	overId: string;
};

export type TableColumnOrderState = string[];

export function normalizeTableColumnOrder(order: readonly string[] | undefined): TableColumnOrderState {
	return Array.from(new Set((order ?? []).filter((columnId) => columnId.trim().length > 0)));
}

function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
	const nextItems = [...items];
	const [item] = nextItems.splice(fromIndex, 1);

	if (item === undefined) {
		return nextItems;
	}

	nextItems.splice(toIndex, 0, item);
	return nextItems;
}

/**
 * Переставляет только верхнеуровневые колонки табличной шапки.
 *
 * Ограничения:
 * - дочерние колонки групп не являются самостоятельными draggable-элементами;
 * - locked-колонки остаются в фиксированном порядке;
 * - pinned-колонки не переносятся между закреплённой и обычной зонами.
 */
export function reorderTableHeaderColumns(args: ReorderTableHeaderColumnsArgs): string[] {
	const { activeId, overId, order } = args;
	if (!activeId || !overId || activeId === overId) return [...order];

	const headerSet = new Set(args.headerIds);
	if (!headerSet.has(activeId) || !headerSet.has(overId)) return [...order];

	const lockedSet = new Set(args.lockedIds ?? []);
	if (lockedSet.has(activeId) || lockedSet.has(overId)) return [...order];

	const pinnedSet = new Set(args.pinnedIds ?? []);
	if (pinnedSet.has(activeId) || pinnedSet.has(overId)) return [...order];

	const nextOrder = [...order];
	if (!nextOrder.includes(activeId)) {
		nextOrder.push(activeId);
	}
	if (!nextOrder.includes(overId)) {
		nextOrder.push(overId);
	}

	const fromIndex = nextOrder.indexOf(activeId);
	const toIndex = nextOrder.indexOf(overId);
	if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return nextOrder;

	return moveItem(nextOrder, fromIndex, toIndex);
}

export function resolveReorderedTableHeaderColumns(args: ReorderTableHeaderColumnsArgs): string[] | null {
	const nextOrder = reorderTableHeaderColumns(args);

	return arraysEqual(nextOrder, args.order) ? null : nextOrder;
}
