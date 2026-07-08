export type ReorderAction = "start" | "end" | "up" | "down";

function resolveTargetIndex(args: { index: number; size: number; action: ReorderAction }): number {
	const { index, size, action } = args;

	switch (action) {
		case "start":
			return 0;
		case "end":
			return size - 1;
		case "up":
			return index - 1;
		case "down":
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
