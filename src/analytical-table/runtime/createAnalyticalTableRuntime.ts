import { validateAnalyticalView } from "../definition/validateAnalyticalView";
import { projectAnalyticalTableExpansion } from "../projections/expansion";

import { buildGroupedAnalyticalModel } from "./buildGroupedModel";
import { filterAnalyticalHierarchy } from "./filtering";
import { prepareAnalyticalHierarchy } from "./hierarchy";
import { sortAnalyticalModel } from "./sorting";
import {
	type AnalyticalTableModel,
	type AnalyticalTableRuntime,
	type AnalyticalViewState,
	type CreateAnalyticalTableRuntimeOptions
} from "./types";

const EMPTY_STATE: AnalyticalViewState = {};
const EMPTY_ITEMS = Object.freeze([]);

/**
 * Создаёт вычислительный runtime для одного снимка.
 *
 * Хранится только последний результат каждого этапа. Исходные строки рассчитываются
 * один раз; фильтры/группировки меняют итоги, сортировка — порядок, раскрытие — видимость.
 * Входные определения, снимки и массивы состояния должны оставаться неизменяемыми.
 */
export function createAnalyticalTableRuntime<T>(options: CreateAnalyticalTableRuntimeOptions<T>): AnalyticalTableRuntime<T> {
	const { definition, snapshot } = options;
	const source = prepareAnalyticalHierarchy(snapshot, definition);
	let previousState: AnalyticalViewState = EMPTY_STATE;
	let filteredRows = source.rows;
	let groupedModel: AnalyticalTableModel<T> | undefined;
	let sortedModel: AnalyticalTableModel<T> | undefined;
	let expandedModel: AnalyticalTableModel<T> | undefined;

	return {
		getModel(state = EMPTY_STATE) {
			validateAnalyticalView(definition, state);
			const filters = state.filters ?? EMPTY_ITEMS;
			const grouping = state.grouping ?? EMPTY_ITEMS;
			const sorting = state.sorting ?? EMPTY_ITEMS;
			const expandedRowIds = state.expandedRowIds ?? EMPTY_ITEMS;
			const filtersChanged = !groupedModel || filters !== (previousState.filters ?? EMPTY_ITEMS);
			const groupingChanged = !groupedModel || grouping !== (previousState.grouping ?? EMPTY_ITEMS);
			const sortingChanged = sorting !== (previousState.sorting ?? EMPTY_ITEMS);
			const expansionChanged = expandedRowIds !== (previousState.expandedRowIds ?? EMPTY_ITEMS);

			const nextFilteredRows = filtersChanged ? filterAnalyticalHierarchy(source.rows, filters, definition.fieldsById) : filteredRows;

			const rebuildGroups = !groupedModel || filtersChanged || groupingChanged;
			const nextGroupedModel = rebuildGroups
				? buildGroupedAnalyticalModel({ definition, source, filteredRows: nextFilteredRows, grouping })
				: groupedModel!;

			const rebuildSorting = !sortedModel || rebuildGroups || sortingChanged;
			const nextSortedModel = rebuildSorting ? sortAnalyticalModel(nextGroupedModel, sorting, definition.fieldsById) : sortedModel!;

			const nextExpandedModel =
				!expandedModel || rebuildSorting || expansionChanged
					? projectAnalyticalTableExpansion(rebuildSorting ? nextSortedModel : (expandedModel ?? nextSortedModel), expandedRowIds)
					: expandedModel;

			// Ошибка callback не должна оставлять стадии от разных состояний в одном runtime.
			filteredRows = nextFilteredRows;
			groupedModel = nextGroupedModel;
			sortedModel = nextSortedModel;
			expandedModel = nextExpandedModel;
			previousState = { filters, grouping, sorting, expandedRowIds };
			return expandedModel;
		}
	};
}
