import { normalizeTextToLower } from "../formatters";

import { type AnalyticalColumn, type AnalyticalDataRow, type AnalyticalFilter } from "./types";
import { compareAnalyticalValues } from "./valueComparison";

/** Операции фильтра относятся к данным, поэтому одинаково работают при SSR и в браузере. */
export function matchesAnalyticalFilter<T>(row: AnalyticalDataRow<T>, filter: AnalyticalFilter, column?: AnalyticalColumn<T>): boolean {
	const value = row.values[filter.id];
	if (column?.filter) return column.filter(value, filter, row);
	const expected = filter.value;
	const compare = (other: unknown) => compareAnalyticalValues(value, other, column);
	const empty = value === null || value === undefined || value === "";
	switch (filter.operator ?? "equals") {
		case "equals":
			return compare(expected) === 0;
		case "notEquals":
			return compare(expected) !== 0;
		case "contains":
			return normalizeTextToLower(String(value ?? "")).includes(normalizeTextToLower(String(expected ?? "")));
		case "startsWith":
			return normalizeTextToLower(String(value ?? "")).startsWith(normalizeTextToLower(String(expected ?? "")));
		case "in":
			return Array.isArray(expected) && expected.some((item: unknown) => compare(item) === 0);
		case "between":
			return Array.isArray(expected) && expected.length === 2 && !empty && compare(expected[0]) >= 0 && compare(expected[1]) <= 0;
		case "gt":
			return !empty && compare(expected) > 0;
		case "gte":
			return !empty && compare(expected) >= 0;
		case "lt":
			return !empty && compare(expected) < 0;
		case "lte":
			return !empty && compare(expected) <= 0;
		case "empty":
			return empty;
		case "notEmpty":
			return !empty;
	}
}
