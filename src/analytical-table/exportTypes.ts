import { type AnalyticalModelRow, type AnalyticalTableModel } from "./modelTypes";

export type AnalyticalExportColumn<TOriginal = unknown> = Readonly<{
	id: string;
	label?: string;
	format?: (value: unknown, row: AnalyticalModelRow<TOriginal>) => unknown;
	/** Общий итог не является строкой исходного дерева и не имеет original/children. */
	formatTotal?: (value: unknown) => unknown;
}>;

export type AnalyticalExportHeader = Readonly<{ id: string; label: string }>;

export type AnalyticalExportRow = Readonly<{ id: string; level: number; kind: "data" | "group" | "grand"; values: readonly unknown[] }>;

export type AnalyticalExportProjection = Readonly<{
	columns: readonly AnalyticalExportHeader[];
	rows: readonly AnalyticalExportRow[];
}>;

export type ProjectAnalyticalTableExportOptions<TOriginal = unknown> = Readonly<{
	model: AnalyticalTableModel<TOriginal>;
	columns?: readonly AnalyticalExportColumn<TOriginal>[];
	scope?: "all" | "visible" | "selected";
	selectedRowIds?: readonly string[];
	includeGroups?: boolean;
	includeGrandTotals?: boolean;
}>;
