import {
	buildAnalyticalTableModel,
	type AnalyticalExportColumn,
	type AnalyticalSnapshot,
	type AnalyticalViewState
} from "../src/analytical-table";

const snapshot: AnalyticalSnapshot<{ label: string }> = {
	rows: [{ id: "stable", original: { label: "Исходная запись" }, values: { amount: 2 } }]
};
const state: AnalyticalViewState = { expandedRowIds: ["stable"] };
const model = buildAnalyticalTableModel({ snapshot, columns: [{ id: "amount", aggregate: "sum" }], state });
const label: string | undefined = model.rows[0].original?.label;
void label;

// @ts-expect-error Снимок не предоставляет изменяемый массив строк.
snapshot.rows.push({ id: "new", values: {} });
// @ts-expect-error Результат индексируется только для чтения.
model.rowById.set("new", model.rows[0]);
// @ts-expect-error Тип исходного DTO сохраняется и в строках результата.
const wrong: number | undefined = model.rows[0].original?.label;
void wrong;

const exportColumn: AnalyticalExportColumn<{ label: string }> = {
	id: "amount",
	format: (value, row) => `${row.original?.label}: ${String(value)}`,
	formatTotal: (value) => String(value)
};
void exportColumn;
