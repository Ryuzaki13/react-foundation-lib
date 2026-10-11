import {
	type AnalyticalExportColumn,
	type AnalyticalExportProjection,
	type AnalyticalTableModel,
	type ProjectAnalyticalTableExportOptions
} from "../types";

/** ID итога устойчив между областями экспорта и не конфликтует даже со скрытой строкой модели. */
function resolveGrandTotalId<T>(model: AnalyticalTableModel<T>): string {
	const baseId = "analytical-grand-total";
	let id = baseId;
	let suffix = 1;
	while (model.rowById.has(id)) id = `${baseId}:${suffix++}`;
	return id;
}

/** Проекция для /excel или /table-document; сам runtime не скачивает файлы и не читает DOM. */
export function projectAnalyticalTableExport<T>(args: ProjectAnalyticalTableExportOptions<T>): AnalyticalExportProjection {
	const { model, scope = "all", includeGroups = true, includeGrandTotals = false } = args;
	const columns: readonly AnalyticalExportColumn<T>[] = args.columns ?? model.columns;
	const selected = new Set(args.selectedRowIds ?? []);
	const source = scope === "visible" ? model.visibleRows : model.flatRows;
	const rows: AnalyticalExportProjection["rows"][number][] = [];

	for (const row of source) {
		if (!includeGroups && row.kind === "group") continue;
		if (scope === "selected" && !selected.has(row.id)) continue;
		rows.push({
			id: row.id,
			level: row.level,
			kind: row.kind,
			values: columns.map((column) => (column.format ? column.format(row.values[column.id], row) : row.values[column.id]))
		});
	}

	if (includeGrandTotals && model.grandTotals) {
		const totals = model.grandTotals;
		rows.push({
			id: resolveGrandTotalId(model),
			level: 0,
			kind: "grand",
			values: columns.map((column) => (column.formatTotal ? column.formatTotal(totals[column.id]) : totals[column.id]))
		});
	}
	return { columns: columns.map((column) => ({ id: column.id, label: column.label ?? column.id })), rows };
}
