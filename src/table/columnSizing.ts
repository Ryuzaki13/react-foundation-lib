/** Числа sizing-state используют единицу, явно выбранную потребителем; по умолчанию это px. */
export type TableColumnSizingState = Record<string, number>;

/** Единица сохранённого размера не зависит от экранных координат pointer/keyboard events. */
export type TableColumnSizingUnit = "px" | "em";

export const DEFAULT_TABLE_COLUMN_MIN_WIDTH = 60;
export const DEFAULT_TABLE_COLUMN_MIN_WIDTH_EM = 4;

/**
 * Нормализует размер в выбранной единице. Для px сохраняется целочисленный контракт,
 * для em остаются четыре знака, чтобы resize не округлялся до целого размера шрифта.
 */
export function normalizeTableColumnWidth(width: number, minWidth?: number, unit: TableColumnSizingUnit = "px"): number {
	const defaultMinWidth = unit === "em" ? DEFAULT_TABLE_COLUMN_MIN_WIDTH_EM : DEFAULT_TABLE_COLUMN_MIN_WIDTH;
	const precision = unit === "em" ? 10_000 : 1;
	const normalizedMinWidth =
		typeof minWidth === "number" && Number.isFinite(minWidth) && minWidth > 0
			? Math.floor(minWidth * precision) / precision
			: defaultMinWidth;
	const normalizedWidth = Number.isFinite(width) ? Math.floor(width * precision) / precision : normalizedMinWidth;

	return Math.max(normalizedMinWidth, normalizedWidth);
}

export function normalizeTableColumnSizing(
	state: Readonly<Record<string, number>> | undefined,
	minWidth?: number,
	unit: TableColumnSizingUnit = "px"
): TableColumnSizingState {
	const nextState: TableColumnSizingState = {};

	for (const [columnId, width] of Object.entries(state ?? {})) {
		if (typeof columnId !== "string" || columnId.trim().length === 0 || !Number.isFinite(width)) {
			continue;
		}

		nextState[columnId] = normalizeTableColumnWidth(width, minWidth, unit);
	}

	return nextState;
}

export function patchTableColumnWidth(
	state: Readonly<Record<string, number>>,
	columnId: string,
	width: number,
	minWidth?: number,
	unit: TableColumnSizingUnit = "px"
): TableColumnSizingState {
	if (columnId.trim().length === 0) {
		return normalizeTableColumnSizing(state, minWidth, unit);
	}

	return {
		...normalizeTableColumnSizing(state, minWidth, unit),
		[columnId]: normalizeTableColumnWidth(width, minWidth, unit)
	};
}

export function removeTableColumnWidth(state: Readonly<Record<string, number>>, columnId: string): TableColumnSizingState {
	const nextState: TableColumnSizingState = {};

	for (const [key, width] of Object.entries(state)) {
		if (key !== columnId) {
			nextState[key] = width;
		}
	}

	return nextState;
}
