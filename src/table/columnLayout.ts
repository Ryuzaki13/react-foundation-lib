import { appendMissingIds, filterAndDeduplicateIds } from "../array";

export type TableColumnLayoutItem<TColumnId extends string = string, TWidth = number> = {
	id: TColumnId;
	width: TWidth;
};

export type ResolveTableColumnOrderArgs<TColumnId extends string = string> = {
	ids: readonly TColumnId[];
	order?: readonly string[];
};

export type BuildTableColumnLayoutArgs<TColumnId extends string = string, TWidth = number> = {
	ids: readonly TColumnId[];
	getWidth: (id: TColumnId) => TWidth;
};

/**
 * Возвращает порядок колонок как в AnalyticalTable: сначала сохранённый order,
 * затем новые или отсутствующие в order id. Ширины при этом остаются привязаны
 * к columnId, а не к визуальной позиции.
 */
export function resolveTableColumnOrder<TColumnId extends string>({ ids, order }: ResolveTableColumnOrderArgs<TColumnId>): TColumnId[] {
	return appendMissingIds(filterAndDeduplicateIds(order, ids), ids);
}

/**
 * Строит layout колонок из уже вычисленного порядка и функции ширины по id.
 */
export function buildTableColumnLayout<TColumnId extends string, TWidth>({
	ids,
	getWidth
}: BuildTableColumnLayoutArgs<TColumnId, TWidth>): TableColumnLayoutItem<TColumnId, TWidth>[] {
	return ids.map((id) => ({
		id,
		width: getWidth(id)
	}));
}
