import { type AnalyticalDataRow, type AnalyticalFilter, type AnalyticalValues } from "../runtime/types";

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
	grandTotalsScope?: "all" | "filtered";
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
	grandTotalsScope: "all" | "filtered";
}>;
