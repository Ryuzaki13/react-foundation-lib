import {
	columnOrderingFeature,
	columnPinningFeature,
	columnResizingFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	createExpandedRowModel,
	rowExpandingFeature,
	rowSelectionFeature,
	tableFeatures
} from "@tanstack/react-table";

/**
 * Единый набор TanStack Table v9 features для foundation-таблиц.
 *
 * Контракт хранится в `lib`, чтобы определения колонок, строк и экземпляров
 * таблицы в `lib` и `ui` всегда использовали один и тот же набор generic-типов.
 */
export const foundationTableFeatures = tableFeatures({
	columnOrderingFeature,
	columnPinningFeature,
	columnSizingFeature,
	columnResizingFeature,
	columnVisibilityFeature,
	rowSelectionFeature,
	rowExpandingFeature,
	expandedRowModel: createExpandedRowModel()
});

/** Generic-контракт features для публичных типов foundation-таблиц. */
export type FoundationTableFeatures = typeof foundationTableFeatures;
