import {
	type TableCellCoordinates,
	type TableCellSelectionActivationMode,
	type TableCellSelectionMode,
	type TableCellSelectionState,
	type TableSelectionModifierEvent
} from "./types";

const TABLE_CELL_SELECTION_ACTIVATION_MODES: ReadonlySet<TableCellSelectionActivationMode> = new Set(["direct", "primary-modifier"]);

/** Строит collision-safe identity координат для дедупликации и сравнения. */
function buildTableCellKey(cell: TableCellCoordinates): string {
	return `${encodeURIComponent(cell.rowId)}::${encodeURIComponent(cell.columnId)}`;
}

/** Проверяет равенство двух наборов координат без зависимости от порядка. */
export function areTableCellSelectionsEqual(left: TableCellSelectionState, right: TableCellSelectionState): boolean {
	if (left.length !== right.length) {
		return false;
	}

	const rightKeys = new Set(right.map(buildTableCellKey));
	return left.every((cell) => rightKeys.has(buildTableCellKey(cell)));
}

/**
 * Оставляет только доступные координаты и приводит их к порядку строк/колонок.
 *
 * Функция не мутирует входные массивы. В `single` последняя координата в
 * детерминированном порядке становится единственным выбранным значением.
 */
export function pruneTableCellSelection(
	selection: TableCellSelectionState | undefined,
	availableRowIds: readonly string[],
	availableColumnIds: readonly string[],
	selectionMode: TableCellSelectionMode
): TableCellCoordinates[] {
	if (selectionMode === "none" || !selection?.length) {
		return [];
	}

	const rowOrder = new Map(availableRowIds.map((rowId, index) => [rowId, index]));
	const columnOrder = new Map(availableColumnIds.map((columnId, index) => [columnId, index]));
	const seen = new Set<string>();
	const nextSelection = selection
		.filter((cell) => {
			if (!(rowOrder.has(cell.rowId) && columnOrder.has(cell.columnId))) {
				return false;
			}

			const key = buildTableCellKey(cell);
			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		})
		.sort((left, right) => {
			const rowDelta = (rowOrder.get(left.rowId) ?? 0) - (rowOrder.get(right.rowId) ?? 0);
			if (rowDelta !== 0) {
				return rowDelta;
			}

			return (columnOrder.get(left.columnId) ?? 0) - (columnOrder.get(right.columnId) ?? 0);
		});

	if (selectionMode === "single") {
		const lastCell = nextSelection.at(-1);
		return lastCell ? [lastCell] : [];
	}

	return nextSelection;
}

/**
 * Вычисляет следующее состояние после активации ячейки.
 *
 * Одиночный выбор допускает явное снятие повторной активацией, а `multi`
 * переключает только переданную координату.
 */
export function toggleTableCellSelection(
	selection: TableCellSelectionState,
	cell: TableCellCoordinates,
	selectionMode: TableCellSelectionMode
): TableCellCoordinates[] {
	if (selectionMode === "none") {
		return [];
	}

	const cellKey = buildTableCellKey(cell);
	const hasCell = selection.some((item) => buildTableCellKey(item) === cellKey);

	if (selectionMode === "single") {
		return hasCell ? [] : [cell];
	}

	return hasCell ? selection.filter((item) => buildTableCellKey(item) !== cellKey) : [...selection, cell];
}

/** Нормализует способ активации ячейки на внешней config-boundary. */
export function normalizeTableCellSelectionActivationMode(
	value: unknown,
	fallback: TableCellSelectionActivationMode = "direct"
): TableCellSelectionActivationMode {
	return typeof value === "string" && TABLE_CELL_SELECTION_ACTIVATION_MODES.has(value as TableCellSelectionActivationMode)
		? (value as TableCellSelectionActivationMode)
		: fallback;
}

/**
 * Проверяет, должно ли событие активировать выбор ячейки.
 *
 * Для `primary-modifier` принимается Ctrl или Command, но не комбинации с
 * Shift/Alt: они зарезервированы браузером, ОС и стандартными selection-flow.
 */
export function shouldActivateTableCellSelection(
	event: TableSelectionModifierEvent,
	activationMode: TableCellSelectionActivationMode
): boolean {
	if (activationMode === "direct") {
		return true;
	}

	return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
}
