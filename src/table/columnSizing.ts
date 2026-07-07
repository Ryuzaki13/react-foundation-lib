export type TableColumnSizingState = Record<string, number>;

export const DEFAULT_TABLE_COLUMN_MIN_WIDTH = 60;

export function normalizeTableColumnWidth(px: number, minWidth: number = DEFAULT_TABLE_COLUMN_MIN_WIDTH): number {
	const normalizedMinWidth = Number.isFinite(minWidth) && minWidth > 0 ? Math.floor(minWidth) : DEFAULT_TABLE_COLUMN_MIN_WIDTH;
	const normalizedWidth = Number.isFinite(px) ? Math.floor(px) : normalizedMinWidth;

	return Math.max(normalizedMinWidth, normalizedWidth);
}

export function normalizeTableColumnSizing(
	state: Readonly<Record<string, number>> | undefined,
	minWidth: number = DEFAULT_TABLE_COLUMN_MIN_WIDTH
): TableColumnSizingState {
	const nextState: TableColumnSizingState = {};

	for (const [columnId, width] of Object.entries(state ?? {})) {
		if (typeof columnId !== "string" || columnId.trim().length === 0 || !Number.isFinite(width)) {
			continue;
		}

		nextState[columnId] = normalizeTableColumnWidth(width, minWidth);
	}

	return nextState;
}

export function patchTableColumnWidth(
	state: Readonly<Record<string, number>>,
	columnId: string,
	width: number,
	minWidth: number = DEFAULT_TABLE_COLUMN_MIN_WIDTH
): TableColumnSizingState {
	if (columnId.trim().length === 0) {
		return normalizeTableColumnSizing(state, minWidth);
	}

	return {
		...normalizeTableColumnSizing(state, minWidth),
		[columnId]: normalizeTableColumnWidth(width, minWidth)
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
