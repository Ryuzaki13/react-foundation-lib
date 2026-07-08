import type { FormattersPipelineTypedValueContext } from "../formatters/pipeline";
import type { EntityColumnProperty } from "../odata-service";
import type { TableColumnAlign, TableColumnDef, TableColumnFormattingMetaInput } from "./types";

/**
 * Опции генерации колонок по OData metadata.
 */
export interface CreateTableColumnsFromODataMetadataOptions {
	/**
	 * Позволяет переопределить заголовок колонки.
	 */
	resolveHeader?: (column: EntityColumnProperty) => string;
	/**
	 * Позволяет сразу навесить formatting-конфиг на generated column.
	 *
	 * `id`, `role` и `type` будут автоматически получены из metadata.
	 */
	resolveFormatting?: (column: EntityColumnProperty) => TableColumnFormattingMetaInput | undefined;
}

/**
 * Опции обогащения уже существующих колонок данными OData metadata.
 */
export interface EnrichTableColumnsWithODataFormattingOptions {
	/**
	 * Позволяет подменить стратегию поиска metadata по колонке.
	 */
	resolveMetadataColumn?: (args: {
		columnId: string;
		metadataColumnsById: ReadonlyMap<string, EntityColumnProperty>;
	}) => EntityColumnProperty | undefined;
}

/**
 * Опции построения стартовой карты видимости колонок по OData metadata.
 */
export interface CreateTableColumnVisibilityFromODataMetadataOptions {
	/**
	 * Позволяет явно переопределить стартовую видимость колонки.
	 */
	resolveVisible?: (column: EntityColumnProperty) => boolean;
}

/**
 * Возвращает typed-formatting контекст по metadata OData-колонки.
 */
export function resolveTableColumnFormattingContextFromODataColumn(column: EntityColumnProperty): FormattersPipelineTypedValueContext {
	const { role, type } = column;
	const forceMeasure = type === "decimal" || type === "float" || type === "double" || type === "int" || type === "byte";

	return {
		role: forceMeasure ? "measure" : role,
		type: type
	};
}

/**
 * Создаёт базовое выравнивание по семантике OData-колонки.
 *
 * NOTE: "не аналитические" все поля возвращают как "dimension"...
 */
function resolveTableColumnAlignFromODataColumn(columnContext: FormattersPipelineTypedValueContext): TableColumnAlign {
	return columnContext.role === "measure" ? "right" : "left";
}

/**
 * Определяет видимость metadata-колонки по умолчанию.
 *
 * Кодовые поля скрываются только если у них есть явная text-пара,
 * чтобы экран по умолчанию показывал человекочитаемое значение.
 */
function resolveMetadataColumnVisibleByDefault(
	column: EntityColumnProperty,
	metadataColumnsById: ReadonlyMap<string, EntityColumnProperty>
): boolean {
	if (column.semanticType !== "code" || !column.linkedColumnId) {
		return true;
	}

	const linkedColumn = metadataColumnsById.get(column.linkedColumnId);

	return linkedColumn?.semanticType !== "text";
}

/**
 * Определяет стабильный идентификатор колонки для сопоставления с metadata.
 */
export function resolveStableColumnId<TData extends object>(column: TableColumnDef<TData>): string | undefined {
	if (typeof column.id === "string" && column.id.trim()) {
		return column.id;
	}

	if ("accessorKey" in column && typeof column.accessorKey === "string" && column.accessorKey.trim()) {
		return column.accessorKey;
	}

	return undefined;
}

/**
 * Рекурсивно обходит только leaf-колонки.
 */
function mapLeafTableColumns<TData extends object>(
	columns: readonly TableColumnDef<TData>[],
	mapper: (column: TableColumnDef<TData>) => TableColumnDef<TData>
): TableColumnDef<TData>[] {
	return columns.map((column) => {
		if ("columns" in column && Array.isArray(column.columns) && column.columns.length > 0) {
			return {
				...column,
				columns: mapLeafTableColumns(column.columns as TableColumnDef<TData>[], mapper)
			};
		}

		return mapper(column);
	});
}

/**
 * Строит стартовую карту видимости колонок из metadata OData-сущности.
 *
 * Возвращает visibility-state для TanStack Table, не удаляя сами колонки
 * из результата build-режима.
 */
export function createTableColumnVisibilityFromODataMetadata(
	metadataColumns: readonly EntityColumnProperty[],
	options?: CreateTableColumnVisibilityFromODataMetadataOptions
): Record<string, boolean> {
	const metadataColumnsById = new Map(metadataColumns.map((column) => [column.id, column]));

	return Object.fromEntries(
		metadataColumns.map((column) => {
			const visible = options?.resolveVisible?.(column) ?? resolveMetadataColumnVisibleByDefault(column, metadataColumnsById);

			return [column.id, visible];
		})
	);
}

/**
 * Создаёт базовые generic-колонки из metadata OData-сущности.
 */
export function createTableColumnsFromODataMetadata<TData extends object = Record<string, unknown>>(
	metadataColumns: readonly EntityColumnProperty[],
	options?: CreateTableColumnsFromODataMetadataOptions
): TableColumnDef<TData>[] {
	return metadataColumns.map((metadataColumn) => {
		// NOTE: Ячейка сама определит выравнивание, `align` только для переопределения
		const columnContext = resolveTableColumnFormattingContextFromODataColumn(metadataColumn);
		const align = resolveTableColumnAlignFromODataColumn(columnContext);
		const resolvedFormatting = options?.resolveFormatting?.(metadataColumn);

		return {
			id: metadataColumn.id,
			accessorKey: metadataColumn.id,
			header: options?.resolveHeader?.(metadataColumn) ?? metadataColumn.label ?? metadataColumn.id,
			meta: {
				align,
				formatting: {
					...resolvedFormatting,
					id: metadataColumn.id,
					role: columnContext.role,
					type: columnContext.type
				}
			}
		};
	}) as TableColumnDef<TData>[];
}

/**
 * Дозаполняет уже существующие колонки typed-formatting контекстом из OData metadata.
 */
export function enrichTableColumnsWithODataFormatting<TData extends object>(
	columns: readonly TableColumnDef<TData>[],
	metadataColumns: readonly EntityColumnProperty[],
	options?: EnrichTableColumnsWithODataFormattingOptions
): TableColumnDef<TData>[] {
	const metadataColumnsById = new Map(metadataColumns.map((column) => [column.id, column]));

	return mapLeafTableColumns(columns, (column) => {
		const columnId = resolveStableColumnId(column);
		if (!columnId) {
			return column;
		}

		const metadataColumn =
			options?.resolveMetadataColumn?.({
				columnId,
				metadataColumnsById
			}) ?? metadataColumnsById.get(columnId);

		if (!metadataColumn) {
			return column;
		}

		if (column.meta?.formatting?.role && column.meta.formatting.type) {
			return column;
		}
		const columnContext = resolveTableColumnFormattingContextFromODataColumn(metadataColumn);

		return {
			...column,
			meta: {
				...column.meta,
				formatting: {
					...column.meta?.formatting,
					id: columnId,
					role: columnContext.role,
					type: columnContext.type
				}
			}
		};
	});
}
