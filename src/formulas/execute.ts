import { isTableFormulaDependency } from "./isTableFormulaDependency";
import { getTableFormulaById } from "./registry";
import {
	TABLE_FORMULA_DEPENDENCY_KIND_CONSTANT,
	TABLE_FORMULA_NOT_FOUND,
	TABLE_FORMULA_INVALID_RESULT,
	TABLE_FORMULA_RUNTIME_ERROR
} from "./tableFormulaConstants";
import {
	type TableFormulaContext,
	type TableFormulaDefinition,
	type TableFormulaDependency,
	type TableFormulaResolvedArgument,
	type TableFormulaRowData
} from "./types";

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
		return typeof dependency === "string" ? dependency : { kind: TABLE_FORMULA_DEPENDENCY_KIND_CONSTANT, value: dependency.value };
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
			reason: typeof TABLE_FORMULA_NOT_FOUND | typeof TABLE_FORMULA_INVALID_RESULT | typeof TABLE_FORMULA_RUNTIME_ERROR;
	  };

export type TableFormulaCompiledExecutor = (rowData: TableFormulaRowData) => TableFormulaExecutionResult;

/** Каждый вызов получает свой набор готовых значений, не удерживаемый compiled executor. */
export type TableFormulaResolvedExecutor = (resolvedArguments: readonly TableFormulaResolvedArgument[]) => TableFormulaExecutionResult;

/** Общая граница ошибок охватывает подготовку контекста, чтение аргументов и саму формулу. */
function executeWithContext(formula: TableFormulaDefinition, createContext: () => TableFormulaContext): TableFormulaExecutionResult {
	try {
		const value = formula.fn(createContext());
		if (!Number.isFinite(value)) {
			return { ok: false, reason: TABLE_FORMULA_INVALID_RESULT };
		}

		return { ok: true, value };
	} catch {
		return { ok: false, reason: TABLE_FORMULA_RUNTIME_ERROR };
	}
}

function createResolvedArgumentsContext(resolvedArguments: readonly TableFormulaResolvedArgument[]): TableFormulaContext {
	if (!Array.isArray(resolvedArguments)) {
		throw new TypeError("Разрешённые аргументы формулы должны быть массивом записей со значением value.");
	}

	// Отсутствующая запись означает ошибку host-подготовки, а собственный value: undefined допустим.
	// Проверяем весь массив, чтобы неиспользуемая позиция также не скрыла неполный набор входов.
	for (let index = 0; index < resolvedArguments.length; index++) {
		const argument: TableFormulaResolvedArgument | undefined = resolvedArguments[index];
		if (
			!Object.hasOwn(resolvedArguments, index) ||
			typeof argument !== "object" ||
			argument === null ||
			!Object.hasOwn(argument, "value") ||
			(argument.key !== undefined && typeof argument.key !== "string")
		) {
			throw new TypeError("Каждый разрешённый аргумент формулы должен содержать собственное value и необязательный строковый key.");
		}
	}

	const readArgument = (index: number): TableFormulaResolvedArgument | undefined => {
		if (!Number.isInteger(index) || index < 0 || index >= resolvedArguments.length) return undefined;
		return resolvedArguments[index];
	};

	return {
		key: (index) => readArgument(index)?.key,
		value: (index) => readArgument(index)?.value,
		num: (index) => toFiniteNumberOrZero(readArgument(index)?.value)
	};
}

type CompileTableFormulaWithResolvedArgumentsResult =
	{ ok: true; execute: TableFormulaResolvedExecutor } | { ok: false; reason: typeof TABLE_FORMULA_NOT_FOUND };

/**
 * Компилирует зарегистрированную формулу независимо от строк и источников её аргументов.
 * Host разрешает позиции перед каждым execute; отдельный контекст сохраняет корректность
 * вложенного вызова того же executor без общего изменяемого указателя на массив.
 */
export function compileTableFormulaWithResolvedArguments(args: {
	formulaId: string | undefined;
}): CompileTableFormulaWithResolvedArgumentsResult {
	const formula = getTableFormulaById(args.formulaId);
	if (!formula) {
		return { ok: false, reason: TABLE_FORMULA_NOT_FOUND };
	}

	return {
		ok: true,
		execute: (resolvedArguments) => executeWithContext(formula, () => createResolvedArgumentsContext(resolvedArguments))
	};
}

/** Разовое выполнение готовых позиций; загрузка источников и их диагностика принадлежат host. */
export function executeTableFormulaWithResolvedArguments(args: {
	formulaId: string | undefined;
	arguments: readonly TableFormulaResolvedArgument[];
}): TableFormulaExecutionResult {
	const compiled = compileTableFormulaWithResolvedArguments({ formulaId: args.formulaId });
	if (!compiled.ok) {
		return { ok: false, reason: compiled.reason };
	}

	return compiled.execute(args.arguments);
}

type CompileTableFormulaResult =
	| {
			ok: true;
			execute: TableFormulaCompiledExecutor;
	  }
	| {
			ok: false;
			reason: typeof TABLE_FORMULA_NOT_FOUND;
	  };

export function compileTableFormula(args: {
	formulaId: string | undefined;
	keys?: readonly TableFormulaDependency[];
}): CompileTableFormulaResult {
	const formula = getTableFormulaById(args.formulaId);
	if (!formula) {
		return { ok: false, reason: TABLE_FORMULA_NOT_FOUND };
	}

	let keys: TableFormulaDependency[];
	try {
		keys = snapshotDependencies(args.keys ?? []);
	} catch {
		// Ошибка новых входов проходит через прежний execution-result, без успешного расчёта с нулём.
		return { ok: true, execute: () => ({ ok: false, reason: TABLE_FORMULA_RUNTIME_ERROR }) };
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
	const createContext = () => context;

	return {
		ok: true,
		execute: (rowData) => {
			rowDataRef = rowData;

			return executeWithContext(formula, createContext);
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
