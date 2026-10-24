import { isTableFormulaDependency } from "./isTableFormulaDependency";
import { getTableFormulaById } from "./registry";
import { type TableFormulaContext, type TableFormulaDependency, type TableFormulaRowData } from "./types";

type TableFormulaContextInstrumentation = {
	onReadIndex?: (index: number) => void;
	onOutOfRangeIndex?: (index: number) => void;
};

function toFiniteNumberOrZero(value: unknown): number {
	const normalized = Number(value);
	return Number.isFinite(normalized) ? normalized : 0;
}

function snapshotDependencies(dependencies: readonly TableFormulaDependency[]): TableFormulaDependency[] {
	return dependencies.map((dependency) => {
		if (!isTableFormulaDependency(dependency)) {
			throw new TypeError("Аргумент формулы должен быть ID поля или конечной числовой константой.");
		}

		// Снимок не должен меняться при последующем редактировании исходной конфигурации.
		return typeof dependency === "string" ? dependency : { kind: "constant", value: dependency.value };
	});
}

export function createTableFormulaContext(args: {
	rowData: TableFormulaRowData;
	keys?: readonly TableFormulaDependency[];
	instrumentation?: TableFormulaContextInstrumentation;
}): TableFormulaContext {
	const keys = snapshotDependencies(args.keys ?? []);

	const readDependency = (index: number): TableFormulaDependency | undefined => {
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
		const dependency = readDependency(index);
		if (!dependency) return undefined;
		return typeof dependency === "string" ? args.rowData[dependency] : dependency.value;
	};

	return {
		key: (index) => {
			const dependency = readDependency(index);
			return typeof dependency === "string" ? dependency : undefined;
		},
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

export function compileTableFormula(args: {
	formulaId: string | undefined;
	keys?: readonly TableFormulaDependency[];
}): CompileTableFormulaResult {
	const formula = getTableFormulaById(args.formulaId);
	if (!formula) {
		return { ok: false, reason: "formula_not_found" };
	}

	let keys: TableFormulaDependency[];
	try {
		keys = snapshotDependencies(args.keys ?? []);
	} catch {
		// Ошибка новых входов проходит через прежний execution-result, без успешного расчёта с нулём.
		return { ok: true, execute: () => ({ ok: false, reason: "runtime_error" }) };
	}
	let rowDataRef: TableFormulaRowData = {};
	const context: TableFormulaContext = {
		key: (index) => {
			if (!Number.isInteger(index) || index < 0 || index >= keys.length) return undefined;
			const dependency = keys[index];
			return typeof dependency === "string" ? dependency : undefined;
		},
		value: (index) => {
			if (!Number.isInteger(index) || index < 0 || index >= keys.length) return undefined;
			const dependency = keys[index];
			if (!dependency) return undefined;
			return typeof dependency === "string" ? rowDataRef[dependency] : dependency.value;
		},
		num: (index) => {
			if (!Number.isInteger(index) || index < 0 || index >= keys.length) return 0;
			const dependency = keys[index];
			if (!dependency) return 0;
			return typeof dependency === "string" ? toFiniteNumberOrZero(rowDataRef[dependency]) : dependency.value;
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
	keys?: readonly TableFormulaDependency[];
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
