import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { RowSelectionState } from "@tanstack/react-table";

import { pruneTableRowSelection, toggleTableRowSelection } from "./selection";
import { TableSelectionMode } from "./types";

interface UseTableRowSelectionParams<TData extends object> {
	availableRowIds: readonly string[];
	rowById: Map<string, TData>;
	selectionMode: TableSelectionMode;
	selectedRowIds?: readonly string[];
	onRowSelectionChange?: (rows: TData[]) => void;
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
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const shouldSkipNextSelectionEmitRef = useRef(false);

	/**
	 * Сравнивает состояния выбора без лишних перерисовок.
	 */
	const areSelectionsEqual = useCallback((left: RowSelectionState, right: RowSelectionState) => {
		const leftRowIds = Object.keys(left).filter((rowId) => left[rowId]);
		const rightRowIds = Object.keys(right).filter((rowId) => right[rowId]);

		if (leftRowIds.length !== rightRowIds.length) {
			return false;
		}

		return leftRowIds.every((rowId) => right[rowId]);

		/*

        Более оптимизированная версия, но для текущего случая может быть практически незначительной

        let leftCount = 0;
		let rightCount = 0;

		for (const rowId of Object.keys(left)) {
			if (!left[rowId]) continue;
			leftCount += 1;
			if (!right[rowId]) {
				return false;
			}
		}

		for (const rowId of Object.keys(right)) {
			if (right[rowId]) {
				rightCount += 1;
			}
		}

		if (leftCount !== rightCount) {
			return false;
		}

		return true;

         */
	}, []);

	const syncRowSelectionState = useEffectEvent((nextAvailableRowIds: readonly string[]) => {
		setRowSelection((currentSelection) => pruneTableRowSelection(currentSelection, nextAvailableRowIds, selectionMode));
	});

	const syncControlledRowSelectionState = useEffectEvent(
		(nextSelectedRowIds: readonly string[], nextAvailableRowIds: readonly string[]) => {
			const nextSelection = pruneTableRowSelection(
				Object.fromEntries(nextSelectedRowIds.map((rowId) => [rowId, true])),
				nextAvailableRowIds,
				selectionMode
			);

			setRowSelection((currentSelection) => {
				if (areSelectionsEqual(currentSelection, nextSelection)) {
					return currentSelection;
				}

				// Пропускаем следующий emit, потому что это синхронизация от внешнего controlled-состояния,
				// а не пользовательское изменение выбора внутри таблицы.
				shouldSkipNextSelectionEmitRef.current = true;

				return nextSelection;
			});
		}
	);

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
		if (selectedRowIds !== undefined) {
			syncControlledRowSelectionState(selectedRowIds, availableRowIds);
			return;
		}

		syncRowSelectionState(availableRowIds);
	}, [availableRowIds, selectedRowIds, selectionMode]);

	useEffect(() => {
		if (shouldSkipNextSelectionEmitRef.current) {
			shouldSkipNextSelectionEmitRef.current = false;
			return;
		}

		emitRowSelectionChange(rowSelection);
	}, [rowSelection]);

	/**
	 * Применяет изменение выбора при активации конкретной строки.
	 */
	const activateRowSelection = useCallback(
		(rowId: string, canSelect: boolean) => {
			if (selectionMode === "none" || !canSelect) {
				return;
			}

			setRowSelection((currentSelection) => toggleTableRowSelection(currentSelection, rowId, selectionMode));
		},
		[selectionMode]
	);

	return {
		rowSelection,
		setRowSelection,
		activateRowSelection
	};
}
