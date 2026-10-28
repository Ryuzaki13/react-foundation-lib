import { createTableFormulaContext } from "./execute";
import { formatTableFormulaExpression } from "./formatTableFormulaExpression";
import { isTableFormulaDependency } from "./isTableFormulaDependency";
import { getTableFormulaById } from "./registry";
import {
	TABLE_FORMULA_NOT_FOUND,
	TABLE_FORMULA_DEPENDENCY_INDEX_OUT_OF_RANGE,
	TABLE_FORMULA_DEPENDENCY_NOT_AVAILABLE,
	TABLE_FORMULA_INVALID_CONSTANT,
	TABLE_FORMULA_UNUSED_DEPENDENCIES,
	TABLE_FORMULA_DOES_NOT_USE_DEPENDENCIES,
	TABLE_FORMULA_VALIDATION_RUNTIME_ERROR
} from "./tableFormulaConstants";
import { type TableFormulaDependency } from "./types";

/** Положительная и отрицательная пробы выявляют обращения к зависимостям в разных ветках формулы. */
const FORMULA_VALIDATION_PROBE_VALUE = 100;

type ValidationCode =
	| typeof TABLE_FORMULA_NOT_FOUND
	| typeof TABLE_FORMULA_DEPENDENCY_INDEX_OUT_OF_RANGE
	| typeof TABLE_FORMULA_DEPENDENCY_NOT_AVAILABLE
	| typeof TABLE_FORMULA_INVALID_CONSTANT
	| typeof TABLE_FORMULA_UNUSED_DEPENDENCIES
	| typeof TABLE_FORMULA_DOES_NOT_USE_DEPENDENCIES
	| typeof TABLE_FORMULA_VALIDATION_RUNTIME_ERROR;

export interface TableFormulaValidationMessage {
	code: ValidationCode;
	message: string;
}
export interface TableFormulaDependenciesValidationResult {
	ok: boolean;
	errors: TableFormulaValidationMessage[];
	warnings: TableFormulaValidationMessage[];
	usage: {
		usedDependencyIndexes: number[];
		usedDependencyIds: string[];
		requiredDependencyCount: number;
	};
}

function toSortedArray(items: Set<number>): number[] {
	return [...items].sort((left, right) => left - right);
}

function createSampleRowData(dependencies: readonly TableFormulaDependency[], multiplier: number): Record<string, unknown> {
	return dependencies.reduce<Record<string, unknown>>((acc, dependency, index) => {
		// Константа сохраняет своё значение в каждом проходе и не создаёт виртуального поля строки.
		if (typeof dependency === "string") acc[dependency] = (index + 1) * multiplier;
		return acc;
	}, {});
}

export function validateTableFormulaDependencies(args: {
	formulaId: string | undefined;
	dependencies?: readonly TableFormulaDependency[];
	availableColumnIds?: readonly string[];
}): TableFormulaDependenciesValidationResult {
	const errors: TableFormulaValidationMessage[] = [];
	const warnings: TableFormulaValidationMessage[] = [];

	const formula = getTableFormulaById(args.formulaId);
	const dependencies = [...(args.dependencies ?? [])];
	const availableColumnIds = args.availableColumnIds ?? [];

	if (!formula) {
		errors.push({
			code: TABLE_FORMULA_NOT_FOUND,
			message: "Формула не найдена в реестре."
		});

		return {
			ok: false,
			errors,
			warnings,
			usage: {
				usedDependencyIndexes: [],
				usedDependencyIds: [],
				requiredDependencyCount: 0
			}
		};
	}

	const availableSet = new Set(availableColumnIds);
	const missingDependencies = dependencies.filter((dependency) => typeof dependency === "string" && !availableSet.has(dependency));
	if (missingDependencies.length > 0) {
		errors.push({
			code: TABLE_FORMULA_DEPENDENCY_NOT_AVAILABLE,
			message: `Не найдены среди доступных полей: ${missingDependencies.join(", ")}.`
		});
	}

	const invalidConstantIndexes = dependencies.flatMap((dependency, index) => (isTableFormulaDependency(dependency) ? [] : [index]));
	if (invalidConstantIndexes.length > 0) {
		errors.push({
			code: TABLE_FORMULA_INVALID_CONSTANT,
			message: `Ожидаются конечные числовые константы в позициях: ${invalidConstantIndexes.map((index) => `$${index}`).join(", ")}.`
		});
	}

	const usedIndexes = new Set<number>();
	const outOfRangeIndexes = new Set<number>();
	let runtimeErrorCount = 0;

	const runValidationPass = (sampleRowData: Record<string, unknown>) => {
		try {
			const context = createTableFormulaContext({
				rowData: sampleRowData,
				keys: dependencies,
				instrumentation: {
					onReadIndex: (index) => {
						usedIndexes.add(index);
					},
					onOutOfRangeIndex: (index) => {
						outOfRangeIndexes.add(index);
					}
				}
			});
			formula.fn(context);
		} catch {
			runtimeErrorCount += 1;
		}
	};

	// Несколько прогонов повышают шанс увидеть обращения к индексам в разных ветках формулы.
	runValidationPass(createSampleRowData(dependencies, FORMULA_VALIDATION_PROBE_VALUE));
	runValidationPass(createSampleRowData(dependencies, -FORMULA_VALIDATION_PROBE_VALUE));

	const sortedUsedIndexes = toSortedArray(usedIndexes);
	const requiredDependencyCount = sortedUsedIndexes.length > 0 ? sortedUsedIndexes[sortedUsedIndexes.length - 1] + 1 : 0;

	if (outOfRangeIndexes.size > 0) {
		errors.push({
			code: TABLE_FORMULA_DEPENDENCY_INDEX_OUT_OF_RANGE,
			message: `Формула обращается к несуществующим индексам. Минимально требуется зависимостей: ${requiredDependencyCount}, выбрано: ${dependencies.length}.`
		});
	}

	if (sortedUsedIndexes.length === 0) {
		warnings.push({
			code: TABLE_FORMULA_DOES_NOT_USE_DEPENDENCIES,
			message: "Формула не использует dependencies."
		});
	}

	const unusedDependencies = dependencies.filter((_, index) => !usedIndexes.has(index));
	if (unusedDependencies.length > 0) {
		warnings.push({
			code: TABLE_FORMULA_UNUSED_DEPENDENCIES,
			message: `Выбраны, но не используются формулой: ${unusedDependencies.map((dependency) => formatTableFormulaExpression("$0", [dependency])).join(", ")}.`
		});
	}

	if (runtimeErrorCount > 0) {
		warnings.push({
			code: TABLE_FORMULA_VALIDATION_RUNTIME_ERROR,
			message: "На тестовых данных формула завершилась с ошибкой."
		});
	}

	const usedDependencyIds = sortedUsedIndexes
		.map((index) => dependencies[index])
		.filter((dependency): dependency is string => typeof dependency === "string" && dependency !== "");

	return {
		ok: errors.length === 0,
		errors,
		warnings,
		usage: {
			usedDependencyIndexes: sortedUsedIndexes,
			usedDependencyIds,
			requiredDependencyCount
		}
	};
}
