import { type Dispatch, type SetStateAction, useCallback, useEffect, useEffectEvent, useState } from "react";

import { type RowSelectionState } from "@tanstack/react-table";

import { arraysEqual } from "../array";

import { areTableRowSelectionsEqual, pruneTableRowSelection, toggleTableRowSelection } from "./selection";
import { TABLE_SELECTION_MODE_NONE } from "./tableSelectionConstants";
import { type TableSelectionMode } from "./types";

interface UseTableRowSelectionParams<TData extends object> {
	availableRowIds: readonly string[];
	rowById: ReadonlyMap<string, TData>;
	selectionMode: TableSelectionMode;
	selectedRowIds?: readonly string[];
	onRowSelectionChange?: (rows: TData[]) => void;
}

function resolveControlledRowSelection(
	selectedRowIds: readonly string[],
	availableRowIds: readonly string[],
	selectionMode: TableSelectionMode
): RowSelectionState {
	return pruneTableRowSelection(Object.fromEntries(selectedRowIds.map((rowId) => [rowId, true])), availableRowIds, selectionMode);
}

/**
 * Общая модель выбора строк для плоской и древовидной таблиц.
 */
export function useTableRowSelection<TData extends object>({
	availableRowIds,
	rowById,
	selectionMode,
	selectedRowIds,
	onRowSelectionChange
}: UseTableRowSelectionParams<TData>) {
	const [selection, setSelection] = useState(() => ({
		availableRowIds,
		selectedRowIds,
		selectionMode,
		rowSelection: selectedRowIds === undefined ? {} : resolveControlledRowSelection(selectedRowIds, availableRowIds, selectionMode),
		notifyChange: selectedRowIds === undefined
	}));
	const { rowSelection, notifyChange } = selection;

	const availableRowsChanged = availableRowIds !== selection.availableRowIds && !arraysEqual(availableRowIds, selection.availableRowIds);
	// Порядок выбранных id влияет на результат в режиме single.
	const selectedRowsChanged =
		selectedRowIds !== selection.selectedRowIds &&
		(selectedRowIds === undefined || selection.selectedRowIds === undefined || !arraysEqual(selectedRowIds, selection.selectedRowIds));

	// Подбираем состояние к новому снимку до commit, чтобы таблица сразу получила актуальный выбор.
	if (availableRowsChanged || selectedRowsChanged || selectionMode !== selection.selectionMode) {
		const next = { availableRowIds, selectedRowIds, selectionMode, rowSelection, notifyChange };

		if (selectedRowIds === undefined) {
			const nextSelection = pruneTableRowSelection(rowSelection, availableRowIds, selectionMode);

			// Нормализация только удаляет ключи. Если состав прежний, сохраняем ссылку и пропускаем уведомление.
			if (Object.keys(nextSelection).length !== Object.keys(rowSelection).length) {
				next.rowSelection = nextSelection;
				next.notifyChange = true;
			}
		} else {
			const nextSelection = resolveControlledRowSelection(selectedRowIds, availableRowIds, selectionMode);

			if (!areTableRowSelectionsEqual(rowSelection, nextSelection)) {
				next.rowSelection = nextSelection;
				next.notifyChange = false;
			}
		}

		setSelection(next);
	}

	const setRowSelection = useCallback<Dispatch<SetStateAction<RowSelectionState>>>((update) => {
		setSelection((current) => {
			const nextSelection = typeof update === "function" ? update(current.rowSelection) : update;

			return nextSelection === current.rowSelection ? current : { ...current, rowSelection: nextSelection, notifyChange: true };
		});
	}, []);

	const emitRowSelectionChange = useEffectEvent((currentSelection: RowSelectionState) => {
		if (!onRowSelectionChange) {
			return;
		}

		const selectedRows: TData[] = [];

		for (const rowId of Object.keys(currentSelection)) {
			if (!currentSelection[rowId]) continue;

			const row = rowById.get(rowId);
			if (row) {
				selectedRows.push(row);
			}
		}

		onRowSelectionChange(selectedRows);
	});

	useEffect(() => {
		if (notifyChange) {
			emitRowSelectionChange(rowSelection);
		}
	}, [notifyChange, rowSelection]);

	/**
	 * Применяет изменение выбора при активации конкретной строки.
	 */
	const activateRowSelection = useCallback(
		(rowId: string, canSelect: boolean) => {
			if (selectionMode === TABLE_SELECTION_MODE_NONE || !canSelect) {
				return;
			}

			setRowSelection((currentSelection) => toggleTableRowSelection(currentSelection, rowId, selectionMode));
		},
		[selectionMode, setRowSelection]
	);

	return {
		rowSelection,
		setRowSelection,
		activateRowSelection
	};
}
