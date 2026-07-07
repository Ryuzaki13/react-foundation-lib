export type TableFormulaRowData = Record<string, unknown>;

export interface TableFormulaContext {
	key: (index: number) => string | undefined;
	value: (index: number) => unknown;
	num: (index: number) => number;
}

export type TableFormulaFn = (ctx: TableFormulaContext) => number;

export interface TableFormulaDefinition {
	id: string;
	name: string;
	description: string;
	args?: readonly string[];
	keywords?: readonly string[];
	fn: TableFormulaFn;
}
