import { RowSelectionState } from "@tanstack/react-table";

import { TableSelectionMode } from "./types";

/**
 * Возвращает только активные идентификаторы выбранных строк.
 */
function getSelectedRowIds(selection: RowSelectionState): string[] {
	return Object.keys(selection).filter((rowId) => selection[rowId]);
}

/**
 * Нормализует состояние выбора относительно списка доступных строк и текущего режима.
 */
export function pruneTableRowSelection(
	selection: RowSelectionState,
	availableRowIds: readonly string[],
	selectionMode: TableSelectionMode
): RowSelectionState {
	if (selectionMode === "none") {
		return {};
	}

	const availableRowIdSet = new Set(availableRowIds);
	const selectedRowIds = getSelectedRowIds(selection).filter((rowId) => availableRowIdSet.has(rowId));

	if (selectionMode === "single") {
		const lastSelectedRowId = selectedRowIds.at(-1);

		return lastSelectedRowId ? { [lastSelectedRowId]: true } : {};
	}

	return Object.fromEntries(selectedRowIds.map((rowId) => [rowId, true]));
}

/**
 * Вычисляет следующее состояние выбора после активации строки пользователем.
 *
 * Семантика:
 * - `none` не хранит выбор;
 * - `single` всегда оставляет только одну строку и не снимает выбор повторным кликом;
 * - `multi` переключает строку как toggle.
 */
export function toggleTableRowSelection(selection: RowSelectionState, rowId: string, selectionMode: TableSelectionMode): RowSelectionState {
	if (selectionMode === "none") {
		return {};
	}

	if (selectionMode === "single") {
		return selection[rowId] ? selection : { [rowId]: true };
	}

	if (selection[rowId]) {
		const nextSelection = { ...selection };

		delete nextSelection[rowId];

		return nextSelection;
	}

	return {
		...selection,
		[rowId]: true
	};
}
