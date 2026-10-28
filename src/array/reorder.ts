// Тип действия и его обработка используют одни значения направления перестановки.
const REORDER_ACTION_START = "start";
const REORDER_ACTION_END = "end";
const REORDER_ACTION_UP = "up";
const REORDER_ACTION_DOWN = "down";

export type ReorderAction = typeof REORDER_ACTION_START | typeof REORDER_ACTION_END | typeof REORDER_ACTION_UP | typeof REORDER_ACTION_DOWN;

function resolveTargetIndex(args: { index: number; size: number; action: ReorderAction }): number {
	const { index, size, action } = args;

	switch (action) {
		case REORDER_ACTION_START:
			return 0;
		case REORDER_ACTION_END:
			return size - 1;
		case REORDER_ACTION_UP:
			return index - 1;
		case REORDER_ACTION_DOWN:
			return index + 1;
	}
}

/**
 * Перемещает элемент списка по одному из предопределённых действий.
 */
export function moveArrayItemByIndex<T>(items: readonly T[], index: number, action: ReorderAction): T[] {
	const nextItems = [...items];
	if (index < 0 || index >= nextItems.length) return nextItems;

	const targetIndex = resolveTargetIndex({
		index,
		size: nextItems.length,
		action
	});
	if (targetIndex < 0 || targetIndex >= nextItems.length || targetIndex === index) return nextItems;

	const [item] = nextItems.splice(index, 1);

	if (item === undefined) return nextItems;

	nextItems.splice(targetIndex, 0, item);
	return nextItems;
}

/**
 * Перемещает элемент списка из одного индекса в другой.
 */
export function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
	const nextItems = [...items];

	if (fromIndex < 0 || fromIndex >= nextItems.length || toIndex < 0 || toIndex >= nextItems.length || fromIndex === toIndex) {
		return nextItems;
	}

	const [item] = nextItems.splice(fromIndex, 1);

	if (item === undefined) {
		return nextItems;
	}

	nextItems.splice(toIndex, 0, item);
	return nextItems;
}
