import { normalizeTextToLower } from "../../formatters";
import { type AnalyticalColumn, type AnalyticalDataRow, type AnalyticalFilter } from "../types";

import {
	ANALYTICAL_FILTER_EQUALS,
	ANALYTICAL_FILTER_NOT_EQUALS,
	ANALYTICAL_FILTER_CONTAINS,
	ANALYTICAL_FILTER_STARTS_WITH,
	ANALYTICAL_FILTER_IN,
	ANALYTICAL_FILTER_BETWEEN,
	ANALYTICAL_FILTER_GT,
	ANALYTICAL_FILTER_GTE,
	ANALYTICAL_FILTER_LT,
	ANALYTICAL_FILTER_LTE,
	ANALYTICAL_FILTER_EMPTY,
	ANALYTICAL_FILTER_NOT_EMPTY
} from "./analyticalViewConstants";
import { type AnalyticalHierarchyNode } from "./hierarchy";
import { compareAnalyticalValues } from "./valueComparison";

/** Операции фильтра относятся к данным, поэтому одинаково работают при SSR и в браузере. */
export function matchesAnalyticalFilter<T>(row: AnalyticalDataRow<T>, filter: AnalyticalFilter, column?: AnalyticalColumn<T>): boolean {
	const value = row.values[filter.id];
	if (column?.filter) return column.filter(value, filter, row);
	const expected = filter.value;
	const compare = (other: unknown) => compareAnalyticalValues(value, other, column);
	const empty = value === null || value === undefined || value === "";
	switch (filter.operator ?? ANALYTICAL_FILTER_EQUALS) {
		case ANALYTICAL_FILTER_EQUALS:
			return compare(expected) === 0;
		case ANALYTICAL_FILTER_NOT_EQUALS:
			return compare(expected) !== 0;
		case ANALYTICAL_FILTER_CONTAINS:
			return normalizeTextToLower(String(value ?? "")).includes(normalizeTextToLower(String(expected ?? "")));
		case ANALYTICAL_FILTER_STARTS_WITH:
			return normalizeTextToLower(String(value ?? "")).startsWith(normalizeTextToLower(String(expected ?? "")));
		case ANALYTICAL_FILTER_IN:
			return Array.isArray(expected) && expected.some((item: unknown) => compare(item) === 0);
		case ANALYTICAL_FILTER_BETWEEN:
			return Array.isArray(expected) && expected.length === 2 && !empty && compare(expected[0]) >= 0 && compare(expected[1]) <= 0;
		case ANALYTICAL_FILTER_GT:
			return !empty && compare(expected) > 0;
		case ANALYTICAL_FILTER_GTE:
			return !empty && compare(expected) >= 0;
		case ANALYTICAL_FILTER_LT:
			return !empty && compare(expected) < 0;
		case ANALYTICAL_FILTER_LTE:
			return !empty && compare(expected) <= 0;
		case ANALYTICAL_FILTER_EMPTY:
			return empty;
		case ANALYTICAL_FILTER_NOT_EMPTY:
			return !empty;
	}
}

/** Совпавший родитель оставляет всю ветвь; совпавший ребёнок сохраняет путь к нему. */
export function filterAnalyticalHierarchy<T>(
	rows: readonly AnalyticalHierarchyNode<T>[],
	filters: readonly AnalyticalFilter[],
	fieldsById: ReadonlyMap<string, AnalyticalColumn<T>>
): readonly AnalyticalHierarchyNode<T>[] {
	if (filters.length === 0) return rows;

	const filtered: AnalyticalHierarchyNode<T>[] = [];
	for (const row of rows) {
		const sourceRow = row.sourceRow;
		const matches = sourceRow && filters.every((filter) => matchesAnalyticalFilter(sourceRow, filter, fieldsById.get(filter.id)));
		if (matches) {
			filtered.push(row);
			continue;
		}

		const children = filterAnalyticalHierarchy(row.children, filters, fieldsById);
		if (children.length > 0) {
			filtered.push({ ...row, children });
		}
	}

	return filtered;
}
