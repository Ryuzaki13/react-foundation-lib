import { type RowSelectionState } from "@tanstack/react-table";

import { TABLE_SELECTION_MODE_MULTI, TABLE_SELECTION_MODE_NONE, TABLE_SELECTION_MODE_SINGLE } from "./tableSelectionConstants";
import { type TableSelectionMode } from "./types";

const TABLE_SELECTION_MODES: ReadonlySet<TableSelectionMode> = new Set([
	TABLE_SELECTION_MODE_NONE,
	TABLE_SELECTION_MODE_SINGLE,
	TABLE_SELECTION_MODE_MULTI
]);

/**
 * Возвращает только активные идентификаторы выбранных строк.
 */
function getSelectedRowIds(selection: RowSelectionState): string[] {
	return Object.keys(selection).filter((rowId) => selection[rowId]);
}

/** Проверяет равенство активных row-selection идентификаторов без учёта порядка ключей. */
export function areTableRowSelectionsEqual(left: RowSelectionState, right: RowSelectionState): boolean {
	const leftRowIds = getSelectedRowIds(left);
	const rightRowIds = getSelectedRowIds(right);

	if (leftRowIds.length !== rightRowIds.length) {
		return false;
	}

	return leftRowIds.every((rowId) => right[rowId]);
}

/** Нормализует неизвестное значение режима выбора строк на внешней config-boundary. */
export function normalizeTableSelectionMode(value: unknown, fallback: TableSelectionMode = TABLE_SELECTION_MODE_NONE): TableSelectionMode {
	return typeof value === "string" && TABLE_SELECTION_MODES.has(value as TableSelectionMode) ? (value as TableSelectionMode) : fallback;
}

/**
 * Нормализует состояние выбора относительно списка доступных строк и текущего режима.
 */
export function pruneTableRowSelection(
	selection: RowSelectionState,
	availableRowIds: readonly string[],
	selectionMode: TableSelectionMode
): RowSelectionState {
	if (selectionMode === TABLE_SELECTION_MODE_NONE) {
		return {};
	}

	const availableRowIdSet = new Set(availableRowIds);
	const selectedRowIds = getSelectedRowIds(selection).filter((rowId) => availableRowIdSet.has(rowId));

	if (selectionMode === TABLE_SELECTION_MODE_SINGLE) {
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
	if (selectionMode === TABLE_SELECTION_MODE_NONE) {
		return {};
	}

	if (selectionMode === TABLE_SELECTION_MODE_SINGLE) {
		const selectedRowIds = getSelectedRowIds(selection);
		return selectedRowIds.length === 1 && selectedRowIds[0] === rowId ? selection : { [rowId]: true };
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
