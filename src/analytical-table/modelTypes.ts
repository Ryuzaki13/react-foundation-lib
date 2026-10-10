import { type AnalyticalAggregateContext, type AnalyticalColumn } from "./columnTypes";
import { type AnalyticalDataRow, type AnalyticalSnapshot, type AnalyticalValues } from "./dataTypes";
import { type AnalyticalViewState } from "./viewTypes";

export type AnalyticalModelRow<TOriginal = unknown> = Readonly<{
	id: string;
	parentId: string | null;
	kind: "data" | "group";
	sourceRow?: AnalyticalDataRow<TOriginal>;
	original?: TOriginal;
	values: AnalyticalValues;
	level: number;
	children: readonly AnalyticalModelRow<TOriginal>[];
	isExpandable: boolean;
	isExpanded: boolean;
	groupingLevelId?: string;
}>;

export type AnalyticalDiagnostics = Readonly<{
	orphanRowIds: readonly string[];
	duplicateRowIds: readonly string[];
	cyclicRowIds: readonly string[];
}>;

export type AnalyticalTableModel<TOriginal = unknown> = Readonly<{
	columns: readonly AnalyticalColumn<TOriginal>[];
	rows: readonly AnalyticalModelRow<TOriginal>[];
	/** Все строки результата в обходе дерева; раскрытие влияет только на visibleRows. */
	flatRows: readonly AnalyticalModelRow<TOriginal>[];
	visibleRows: readonly AnalyticalModelRow<TOriginal>[];
	rowById: ReadonlyMap<string, AnalyticalModelRow<TOriginal>>;
	grandTotals: AnalyticalValues | null;
	diagnostics: AnalyticalDiagnostics;
}>;

export type BuildAnalyticalTableModelOptions<TOriginal = unknown> = Readonly<{
	snapshot: AnalyticalSnapshot<TOriginal>;
	columns: readonly AnalyticalColumn<TOriginal>[];
	state?: AnalyticalViewState;
	/** По умолчанию агрегируются исходные корневые строки: дети не удваивают меры. */
	isAggregateRow?: (row: AnalyticalDataRow<TOriginal>) => boolean;
	aggregate?: (context: AnalyticalAggregateContext<TOriginal>) => AnalyticalValues;
	grandTotals?: boolean;
	/** all сохраняет общие итоги при визуальной фильтрации отдельных ветвей. */
	grandTotalsScope?: "all" | "filtered";
}>;
