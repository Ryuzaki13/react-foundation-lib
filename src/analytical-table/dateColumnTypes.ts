import { type AnalyticalAggregation } from "./columnTypes";
import { type AnalyticalDataRow, type AnalyticalValues } from "./dataTypes";

/** Dynamic facts уже входят в снимок: проектирование не выполняет запросов. */
export type AnalyticalDateColumnsOptions = Readonly<{
	id: string;
	from: string;
	to: string;
	granularity: "day" | "week" | "month" | "quarter" | "year";
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
