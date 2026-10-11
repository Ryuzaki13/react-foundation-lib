import {
	type AnalyticalColumn,
	type AnalyticalGroupingLevel,
	type AnalyticalTableDefinition,
	type CompiledAnalyticalTableDefinition
} from "../definition/types";

/** Значения таблицы отделены от исходного DTO: runtime не изменяет снимок Query. */
export type AnalyticalValues = Readonly<Record<string, unknown>>;

export type AnalyticalDataRow<TOriginal = unknown> = Readonly<{
	id: string;
	parentId?: string | null;
	kind?: string;
	original?: TOriginal;
	values: AnalyticalValues;
}>;

/** Готовый полный снимок. Его загрузкой и отменой владеет транспорт потребителя. */
export type AnalyticalSnapshot<TOriginal = unknown> = Readonly<{
	rows: readonly AnalyticalDataRow<TOriginal>[];
}>;

export type AnalyticalSorting = Readonly<{
	id: string;
	desc?: boolean;
}>;

export type AnalyticalFilter = Readonly<{
	id: string;
	operator?: "equals" | "notEquals" | "contains" | "startsWith" | "in" | "between" | "gt" | "gte" | "lt" | "lte" | "empty" | "notEmpty";
	value?: unknown;
}>;

/** Состояние сериализуется для SSR/URL; Map и Set появляются только в результате. */
export type AnalyticalViewState = Readonly<{
	grouping?: readonly AnalyticalGroupingLevel[];
	sorting?: readonly AnalyticalSorting[];
	filters?: readonly AnalyticalFilter[];
	expandedRowIds?: readonly string[] | "all";
}>;

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

export type BuildAnalyticalTableModelOptions<TOriginal = unknown> = AnalyticalTableDefinition<TOriginal> &
	Readonly<{
		snapshot: AnalyticalSnapshot<TOriginal>;
		state?: AnalyticalViewState;
	}>;

export type CreateAnalyticalTableRuntimeOptions<TOriginal = unknown> = Readonly<{
	definition: CompiledAnalyticalTableDefinition<TOriginal>;
	snapshot: AnalyticalSnapshot<TOriginal>;
}>;

/** Runtime принадлежит одному неизменяемому снимку; новый снимок создаёт новый runtime. */
export type AnalyticalTableRuntime<TOriginal = unknown> = Readonly<{
	getModel: (state?: AnalyticalViewState) => AnalyticalTableModel<TOriginal>;
}>;
