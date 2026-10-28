import { type TABLE_FORMULA_DEPENDENCY_KIND_CONSTANT } from "./tableFormulaConstants";

export type TableFormulaRowData = Record<string, unknown>;

/**
 * Позиционный аргумент формулы: ID поля строки либо конечная числовая константа.
 *
 * Константа занимает обычную позицию аргумента, но не создаёт зависимости от
 * данных строки. Строковая форма сохраняет контракт существующих consumers.
 */
export type TableFormulaDependency = string | { readonly kind: typeof TABLE_FORMULA_DEPENDENCY_KIND_CONSTANT; readonly value: number };

export interface TableFormulaContext {
	/** Возвращает ID только для аргумента-поля; у константы ключа строки нет. */
	key: (index: number) => string | undefined;
	value: (index: number) => unknown;
	num: (index: number) => number;
}

export type TableFormulaFn = (ctx: TableFormulaContext) => number;

export interface TableFormulaDefinition {
	id: string;
	name: string;
	description: string;
	/** Шаблон превью с позициями $n; описывает выражение для человека и не участвует в выполнении fn. */
	expressionTemplate?: string;
	args?: readonly string[];
	keywords?: readonly string[];
	fn: TableFormulaFn;
}
