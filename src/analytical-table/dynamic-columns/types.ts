import { type AnalyticalAggregation } from "../definition/types";
import { type AnalyticalDataRow, type AnalyticalValues } from "../runtime/types";

import {
	type ANALYTICAL_DATE_GRANULARITY_DAY,
	type ANALYTICAL_DATE_GRANULARITY_WEEK,
	type ANALYTICAL_DATE_GRANULARITY_MONTH,
	type ANALYTICAL_DATE_GRANULARITY_QUARTER,
	type ANALYTICAL_DATE_GRANULARITY_YEAR
} from "./analyticalDateColumnConstants";

/** Dynamic facts уже входят в снимок: проектирование не выполняет запросов. */
export type AnalyticalDateColumnsOptions = Readonly<{
	id: string;
	from: string;
	to: string;
	granularity:
		| typeof ANALYTICAL_DATE_GRANULARITY_DAY
		| typeof ANALYTICAL_DATE_GRANULARITY_WEEK
		| typeof ANALYTICAL_DATE_GRANULARITY_MONTH
		| typeof ANALYTICAL_DATE_GRANULARITY_QUARTER
		| typeof ANALYTICAL_DATE_GRANULARITY_YEAR;
	identityColumnIds: readonly string[];
	/** Поле факта должно содержать только YYYY-MM-DD; Date/timestamp отклоняются. */
	dateColumnId: string;
	measureColumnId: string;
	aggregation: AnalyticalAggregation;
	maxColumns?: number;
}>;

export type AnalyticalDateColumn = Readonly<{
	id: string;
	label: string;
	from: string;
	to: string;
}>;

export type AnalyticalDateColumnsPlan = Readonly<{
	options: AnalyticalDateColumnsOptions;
	columns: readonly AnalyticalDateColumn[];
}>;

export type ProjectAnalyticalDateFactsOptions<TOriginal = unknown> = Readonly<{
	rows: readonly AnalyticalDataRow<TOriginal>[];
	facts: readonly AnalyticalValues[];
	plan: AnalyticalDateColumnsPlan;
}>;
