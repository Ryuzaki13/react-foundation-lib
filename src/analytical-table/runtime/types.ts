import {
	type AnalyticalColumn,
	type AnalyticalGroupingLevel,
	type AnalyticalTableDefinition,
	type CompiledAnalyticalTableDefinition
} from "../definition/types";

import { type ANALYTICAL_ROW_KIND_DATA, type ANALYTICAL_ROW_KIND_GROUP } from "./analyticalRowConstants";
import {
	type ANALYTICAL_FILTER_EQUALS,
	type ANALYTICAL_FILTER_NOT_EQUALS,
	type ANALYTICAL_FILTER_CONTAINS,
	type ANALYTICAL_FILTER_STARTS_WITH,
	type ANALYTICAL_FILTER_IN,
	type ANALYTICAL_FILTER_BETWEEN,
	type ANALYTICAL_FILTER_GT,
	type ANALYTICAL_FILTER_GTE,
	type ANALYTICAL_FILTER_LT,
	type ANALYTICAL_FILTER_LTE,
	type ANALYTICAL_FILTER_EMPTY,
	type ANALYTICAL_FILTER_NOT_EMPTY,
	type ANALYTICAL_EXPANSION_ALL
} from "./analyticalViewConstants";

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
	operator?:
		| typeof ANALYTICAL_FILTER_EQUALS
		| typeof ANALYTICAL_FILTER_NOT_EQUALS
		| typeof ANALYTICAL_FILTER_CONTAINS
		| typeof ANALYTICAL_FILTER_STARTS_WITH
		| typeof ANALYTICAL_FILTER_IN
		| typeof ANALYTICAL_FILTER_BETWEEN
		| typeof ANALYTICAL_FILTER_GT
		| typeof ANALYTICAL_FILTER_GTE
		| typeof ANALYTICAL_FILTER_LT
		| typeof ANALYTICAL_FILTER_LTE
		| typeof ANALYTICAL_FILTER_EMPTY
		| typeof ANALYTICAL_FILTER_NOT_EMPTY;
	value?: unknown;
}>;

/** Состояние сериализуется для SSR/URL; Map и Set появляются только в результате. */
export type AnalyticalViewState = Readonly<{
	grouping?: readonly AnalyticalGroupingLevel[];
	sorting?: readonly AnalyticalSorting[];
	filters?: readonly AnalyticalFilter[];
	expandedRowIds?: readonly string[] | typeof ANALYTICAL_EXPANSION_ALL;
}>;

export type AnalyticalModelRow<TOriginal = unknown> = Readonly<{
	id: string;
	parentId: string | null;
	kind: typeof ANALYTICAL_ROW_KIND_DATA | typeof ANALYTICAL_ROW_KIND_GROUP;
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
