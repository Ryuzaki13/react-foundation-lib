import { type AnalyticalModelRow, type AnalyticalTableModel } from "../types";

import {
	type ANALYTICAL_EXPORT_SCOPE_ALL,
	type ANALYTICAL_EXPORT_SCOPE_VISIBLE,
	type ANALYTICAL_EXPORT_SCOPE_SELECTED,
	type ANALYTICAL_EXPORT_ROW_KIND_GRAND
} from "./analyticalExportConstants";

export type AnalyticalExportColumn<TOriginal = unknown> = Readonly<{
	id: string;
	label?: string;
	format?: (value: unknown, row: AnalyticalModelRow<TOriginal>) => unknown;
	/** Общий итог не является строкой исходного дерева и не имеет original/children. */
	formatTotal?: (value: unknown) => unknown;
}>;

export type AnalyticalExportHeader = Readonly<{ id: string; label: string }>;

export type AnalyticalExportRow = Readonly<{
	id: string;
	level: number;
	kind: AnalyticalModelRow["kind"] | typeof ANALYTICAL_EXPORT_ROW_KIND_GRAND;
	values: readonly unknown[];
}>;

export type AnalyticalExportProjection = Readonly<{
	columns: readonly AnalyticalExportHeader[];
	rows: readonly AnalyticalExportRow[];
}>;

export type ProjectAnalyticalTableExportOptions<TOriginal = unknown> = Readonly<{
	model: AnalyticalTableModel<TOriginal>;
	columns?: readonly AnalyticalExportColumn<TOriginal>[];
	scope?: typeof ANALYTICAL_EXPORT_SCOPE_ALL | typeof ANALYTICAL_EXPORT_SCOPE_VISIBLE | typeof ANALYTICAL_EXPORT_SCOPE_SELECTED;
	selectedRowIds?: readonly string[];
	includeGroups?: boolean;
	includeGrandTotals?: boolean;
}>;
