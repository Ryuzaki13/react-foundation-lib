/** Составной ключ отделён от отображаемых полей и не зависит от сортировки. */
export type AnalyticalGroupingLevel = Readonly<{
	id: string;
	keyColumnIds: readonly string[];
	displayColumnIds?: readonly string[];
	label?: string;
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
