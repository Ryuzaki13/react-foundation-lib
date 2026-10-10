import { type AnalyticalDataRow, type AnalyticalValues } from "./dataTypes";
import { type AnalyticalFilter } from "./viewTypes";

export type AnalyticalAggregation = "sum" | "min" | "max" | "avg" | "count";

export type AnalyticalAggregateContext<TOriginal = unknown> = Readonly<{
	scope: "group" | "grand";
	/** Только исходные строки выбранной зернистости, без синтетических групп. */
	rows: readonly AnalyticalDataRow<TOriginal>[];
	groupingPath: AnalyticalValues;
}>;

export type AnalyticalFormula = Readonly<{ formulaId: string; dependencies: readonly string[] }>;

export type AnalyticalCalculation = Readonly<{ dependencies: readonly string[]; compute: (values: AnalyticalValues) => unknown }>;

export type AnalyticalColumn<TOriginal = unknown> = Readonly<{
	id: string;
	label?: string;
	kind?: "dimension" | "measure";
	valueType?: "string" | "number" | "boolean" | "date";
	compare?: (left: unknown, right: unknown) => number;
	filter?: (value: unknown, filter: AnalyticalFilter, row: AnalyticalDataRow<TOriginal>) => boolean;
	aggregate?: AnalyticalAggregation | ((context: AnalyticalAggregateContext<TOriginal>) => unknown);
	/** Исполнение использует реестр /formulas; зависимости определяют порядок расчёта. */
	formula?: AnalyticalFormula;
	calculate?: AnalyticalCalculation;
}>;
