import { type AnalyticalExportColumn, type AnalyticalExportProjection, type ProjectAnalyticalTableExportOptions } from "./types";

/** Проекция для /excel или /table-document; сам runtime не скачивает файлы и не читает DOM. */
export function projectAnalyticalTableExport<T>(args: ProjectAnalyticalTableExportOptions<T>): AnalyticalExportProjection {
	const { model } = args;
	const columns: readonly AnalyticalExportColumn<T>[] = args.columns ?? model.columns;
	const selected = new Set(args.selectedRowIds ?? []);
	const source = args.scope === "visible" ? model.visibleRows : model.flatRows;
	const rows: AnalyticalExportProjection["rows"][number][] = source
		.filter((row) => (args.includeGroups !== false || row.kind !== "group") && (args.scope !== "selected" || selected.has(row.id)))
		.map((row) => ({
			id: row.id,
			level: row.level,
			kind: row.kind,
			values: columns.map((column) => (column.format ? column.format(row.values[column.id], row) : row.values[column.id]))
		}));
	if (args.includeGrandTotals && model.grandTotals)
		rows.push({
			id: "analytical-grand-total",
			level: 0,
			kind: "grand",
			values: columns.map((column) => {
				const value = model.grandTotals?.[column.id];
				return column.formatTotal ? column.formatTotal(value) : value;
			})
		});
	return { columns: columns.map((column) => ({ id: column.id, label: column.label ?? column.id })), rows };
}
