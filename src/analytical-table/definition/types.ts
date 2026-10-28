import { type AnalyticalDataRow, type AnalyticalFilter, type AnalyticalValues } from "../runtime/types";

import {
	type ANALYTICAL_AGGREGATION_SUM,
	type ANALYTICAL_AGGREGATION_MIN,
	type ANALYTICAL_AGGREGATION_MAX,
	type ANALYTICAL_AGGREGATION_AVG,
	type ANALYTICAL_AGGREGATION_COUNT,
	type ANALYTICAL_AGGREGATE_SCOPE_GROUP,
	type ANALYTICAL_AGGREGATE_SCOPE_GRAND,
	type ANALYTICAL_TOTALS_SCOPE_ALL,
	type ANALYTICAL_TOTALS_SCOPE_FILTERED,
	type ANALYTICAL_VALUE_TYPE_STRING,
	type ANALYTICAL_VALUE_TYPE_NUMBER,
	type ANALYTICAL_VALUE_TYPE_BOOLEAN,
	type ANALYTICAL_VALUE_TYPE_DATE
} from "./analyticalDefinitionConstants";

export type AnalyticalAggregation =
	| typeof ANALYTICAL_AGGREGATION_SUM
	| typeof ANALYTICAL_AGGREGATION_MIN
	| typeof ANALYTICAL_AGGREGATION_MAX
	| typeof ANALYTICAL_AGGREGATION_AVG
	| typeof ANALYTICAL_AGGREGATION_COUNT;

export type AnalyticalAggregateContext<TOriginal = unknown> = Readonly<{
	scope: typeof ANALYTICAL_AGGREGATE_SCOPE_GROUP | typeof ANALYTICAL_AGGREGATE_SCOPE_GRAND;
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
	valueType?:
		| typeof ANALYTICAL_VALUE_TYPE_STRING
		| typeof ANALYTICAL_VALUE_TYPE_NUMBER
		| typeof ANALYTICAL_VALUE_TYPE_BOOLEAN
		| typeof ANALYTICAL_VALUE_TYPE_DATE;
	compare?: (left: unknown, right: unknown) => number;
	filter?: (value: unknown, filter: AnalyticalFilter, row: AnalyticalDataRow<TOriginal>) => boolean;
	aggregate?: AnalyticalAggregation | ((context: AnalyticalAggregateContext<TOriginal>) => unknown);
	/** Исполнение использует реестр /formulas; зависимости определяют порядок расчёта. */
	formula?: AnalyticalFormula;
	calculate?: AnalyticalCalculation;
}>;

export type AnalyticalCalculationStep = Readonly<{
	columnId: string;
	dependencies: readonly string[];
	compute: (values: AnalyticalValues) => unknown;
}>;

export type AnalyticalCalculationPlan = Readonly<{
	steps: readonly AnalyticalCalculationStep[];
	requiredColumnIds: readonly string[];
}>;

/** Составной ключ отделён от отображаемых полей и не зависит от сортировки. */
export type AnalyticalGroupingLevel = Readonly<{
	id: string;
	keyColumnIds: readonly string[];
	displayColumnIds?: readonly string[];
	label?: string;
}>;

/** Описание таблицы не зависит от снимка данных и текущего состояния интерфейса. */
export type AnalyticalTableDefinition<TOriginal = unknown> = Readonly<{
	columns: readonly AnalyticalColumn<TOriginal>[];
	/** Служебные поля участвуют в формулах и итогах, но не добавляются в отображаемые столбцы. */
	dataFields?: readonly AnalyticalColumn<TOriginal>[];
	/** Выбирает исходные строки для итогов. По умолчанию участвуют только корни исходного дерева. */
	isAggregateRow?: (row: AnalyticalDataRow<TOriginal>) => boolean;
	/** Дополняет итоги группы или всей таблицы; возвращённые значения имеют приоритет над формулами. */
	aggregate?: (context: AnalyticalAggregateContext<TOriginal>) => AnalyticalValues;
	/** Общий итог включён по умолчанию. */
	grandTotals?: boolean;
	/** По умолчанию общий итог рассчитывается по отфильтрованным строкам выбранной зернистости. */
	grandTotalsScope?: typeof ANALYTICAL_TOTALS_SCOPE_ALL | typeof ANALYTICAL_TOTALS_SCOPE_FILTERED;
}>;

/** Проверенное описание: индексы и формулы подготавливаются один раз до обработки снимка. */
export type CompiledAnalyticalTableDefinition<TOriginal = unknown> = Readonly<{
	columns: readonly AnalyticalColumn<TOriginal>[];
	fieldsById: ReadonlyMap<string, AnalyticalColumn<TOriginal>>;
	calculations: AnalyticalCalculationPlan;
	aggregateFields: readonly AnalyticalColumn<TOriginal>[];
	isAggregateRow?: AnalyticalTableDefinition<TOriginal>["isAggregateRow"];
	aggregate?: AnalyticalTableDefinition<TOriginal>["aggregate"];
	grandTotals: boolean;
	grandTotalsScope: typeof ANALYTICAL_TOTALS_SCOPE_ALL | typeof ANALYTICAL_TOTALS_SCOPE_FILTERED;
}>;
