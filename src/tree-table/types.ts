/**
 * Контракт преобразования плоского списка OData-строк в дерево.
 */
export interface TreeTableFlatHierarchy<TData extends object> {
	/**
	 * Возвращает стабильный идентификатор строки.
	 */
	getRowId: (row: TData) => string;
	/**
	 * Возвращает идентификатор родителя.
	 *
	 * `null` и `undefined` означают корневую строку.
	 */
	getParentRowId: (row: TData) => string | null | undefined;
}

/**
 * Внутреннее представление строки для TanStack Table.
 */
export type TreeTableRowNode<TData extends object> = TData & {
	children?: TreeTableRowNode<TData>[];
};

/**
 * Результат построения дерева из плоского источника.
 */
export interface TreeTableBuildResult<TData extends object> {
	/**
	 * Корневые узлы уже в иерархическом виде.
	 */
	rows: TreeTableRowNode<TData>[];
	/**
	 * Быстрый доступ к исходной строке по идентификатору.
	 */
	rowById: Map<string, TData>;
	/**
	 * Все уникальные идентификаторы строк в исходном порядке.
	 */
	allRowIds: string[];
	/**
	 * Идентификаторы строк, попавших в корень дерева.
	 */
	rootRowIds: string[];
	/**
	 * Строки, у которых указан несуществующий родитель.
	 */
	orphanRowIds: string[];
	/**
	 * Повторяющиеся идентификаторы, проигнорированные при построении дерева.
	 */
	duplicateRowIds: string[];
	/**
	 * Идентификаторы строк, участвующих в циклических ссылках.
	 */
	cyclicRowIds: string[];
}

export const TREE_TABLE_TRANSPOSED_ROW_ID_FIELD = "__treeTableRowId";
export const TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD = "__treeTableParentRowId";
export const TREE_TABLE_TRANSPOSED_LABEL_FIELD = "__treeTableLabel";
export const TREE_TABLE_TRANSPOSED_LEVEL_FIELD = "__treeTableLevel";
export const TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD = "__treeTableSynthetic";

/**
 * Служебные поля строки, полученной транспонированием плоских данных в дерево.
 */
export type TreeTableTransposedRowMeta = {
	[TREE_TABLE_TRANSPOSED_ROW_ID_FIELD]: string;
	[TREE_TABLE_TRANSPOSED_PARENT_ROW_ID_FIELD]: string | null;
	[TREE_TABLE_TRANSPOSED_LABEL_FIELD]: string;
	[TREE_TABLE_TRANSPOSED_LEVEL_FIELD]: number;
	[TREE_TABLE_TRANSPOSED_SYNTHETIC_FIELD]: boolean;
};

export type TreeTableTransposedRow<TData extends object> = TData & TreeTableTransposedRowMeta;

export type TreeTableTransposeFlatRowsLevel = {
	/**
	 * Колонка backend-строки, которая станет уровнем дерева.
	 */
	columnId: string;
	/**
	 * Если включено, runtime раскрывает узлы этого уровня при первичном построении дерева.
	 */
	expandByDefault?: boolean;
};

export type TreeTableTransposeFlatRowsOptions = {
	/**
	 * Колонки, которые образуют уровни дерева в порядке сверху вниз.
	 */
	hierarchyLevels: readonly TreeTableTransposeFlatRowsLevel[];
};
