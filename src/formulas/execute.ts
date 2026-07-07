import { getTableFormulaById } from "./registry";

import type { TableFormulaContext, TableFormulaRowData } from "./types";

type TableFormulaContextInstrumentation = {
	onReadIndex?: (index: number) => void;
	onOutOfRangeIndex?: (index: number) => void;
};

function toFiniteNumberOrZero(value: unknown): number {
	const normalized = Number(value);
	return Number.isFinite(normalized) ? normalized : 0;
}

export function createTableFormulaContext(args: {
	rowData: TableFormulaRowData;
	keys?: readonly string[];
	instrumentation?: TableFormulaContextInstrumentation;
}): TableFormulaContext {
	// TODO: duplicate createRowBasedFormatterContext src\shared\lib\formatters\rowBased\context.ts
	const keys = [...(args.keys ?? [])];

	const readKey = (index: number): string | undefined => {
		if (!Number.isInteger(index) || index < 0) {
			args.instrumentation?.onOutOfRangeIndex?.(index);
			return undefined;
		}

		args.instrumentation?.onReadIndex?.(index);

		if (index >= keys.length) {
			args.instrumentation?.onOutOfRangeIndex?.(index);
			return undefined;
		}

		return keys[index];
	};

	const readValue = (index: number): unknown => {
		const key = readKey(index);
		if (!key) return undefined;
		return args.rowData[key];
	};

	return {
		key: readKey,
		value: readValue,
		num: (index) => toFiniteNumberOrZero(readValue(index))
	};
}

export type TableFormulaExecutionResult =
	| {
			ok: true;
			value: number;
	  }
	| {
			ok: false;
			reason: "formula_not_found" | "invalid_result" | "runtime_error";
	  };

export type TableFormulaCompiledExecutor = (rowData: TableFormulaRowData) => TableFormulaExecutionResult;

type CompileTableFormulaResult =
	| {
			ok: true;
			execute: TableFormulaCompiledExecutor;
	  }
	| {
			ok: false;
			reason: "formula_not_found";
	  };

export function compileTableFormula(args: { formulaId: string | undefined; keys?: readonly string[] }): CompileTableFormulaResult {
	const formula = getTableFormulaById(args.formulaId);
	if (!formula) {
		return { ok: false, reason: "formula_not_found" };
	}

	const keys = [...(args.keys ?? [])];
	let rowDataRef: TableFormulaRowData = {};
	const context: TableFormulaContext = {
		key: (index) => (Number.isInteger(index) && index >= 0 && index < keys.length ? keys[index] : undefined),
		value: (index) => {
			if (!Number.isInteger(index) || index < 0 || index >= keys.length) return undefined;
			const key = keys[index];
			if (!key) return undefined;
			return rowDataRef[key];
		},
		num: (index) => {
			if (!Number.isInteger(index) || index < 0 || index >= keys.length) return 0;
			const key = keys[index];
			if (!key) return 0;
			return toFiniteNumberOrZero(rowDataRef[key]);
		}
	};

	return {
		ok: true,
		execute: (rowData) => {
			rowDataRef = rowData;

			try {
				const value = formula.fn(context);
				if (!Number.isFinite(value)) {
					return { ok: false, reason: "invalid_result" };
				}

				return { ok: true, value };
			} catch {
				return { ok: false, reason: "runtime_error" };
			}
		}
	};
}

export function executeTableFormula(args: {
	formulaId: string | undefined;
	rowData: TableFormulaRowData;
	keys?: readonly string[];
}): TableFormulaExecutionResult {
	const compiled = compileTableFormula({
		formulaId: args.formulaId,
		keys: args.keys
	});
	if (!compiled.ok) {
		return { ok: false, reason: compiled.reason };
	}

	return compiled.execute(args.rowData);
}
