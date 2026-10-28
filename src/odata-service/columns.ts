import { ODATA_COLUMN_SEMANTIC_CODE } from "./odataMetadataConstants";
import { EntityColumnProperty } from "./types";

/**
 * Возвращает code-like filterable-колонки.
 */
export function collectFilterableColumns(columns: readonly Readonly<EntityColumnProperty>[]): Readonly<EntityColumnProperty>[] {
	return columns.filter((column) => column.semanticType === ODATA_COLUMN_SEMANTIC_CODE && column.filterable);
}

/**
 * Возвращает идентификаторы code-like filterable-колонок.
 */
export function collectFilterableColumnsIds(columns: readonly Readonly<EntityColumnProperty>[]): Readonly<Set<string>> {
	return new Set(collectFilterableColumns(columns).map((c) => c.id));
}
