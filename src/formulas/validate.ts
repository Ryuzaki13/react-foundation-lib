import { createTableFormulaContext } from "./execute";
import { getTableFormulaById } from "./registry";

type ValidationCode =
	| "formula_not_found"
	| "dependency_index_out_of_range"
	| "dependency_not_available"
	| "unused_dependencies"
	| "formula_does_not_use_dependencies"
	| "formula_runtime_error";

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

function createSampleRowData(dependencies: readonly string[], multiplier: number): Record<string, unknown> {
	return dependencies.reduce<Record<string, unknown>>((acc, dependencyId, index) => {
		acc[dependencyId] = (index + 1) * multiplier;
		return acc;
	}, {});
}

export function validateTableFormulaDependencies(args: {
	formulaId: string | undefined;
	dependencies?: readonly string[];
	availableColumnIds?: readonly string[];
}): TableFormulaDependenciesValidationResult {
	const errors: TableFormulaValidationMessage[] = [];
	const warnings: TableFormulaValidationMessage[] = [];

	const formula = getTableFormulaById(args.formulaId);
	const dependencies = [...(args.dependencies ?? [])];
	const availableColumnIds = args.availableColumnIds ?? [];

	if (!formula) {
		errors.push({
			code: "formula_not_found",
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
	const missingDependencies = dependencies.filter((dependencyId) => !availableSet.has(dependencyId));
	if (missingDependencies.length > 0) {
		errors.push({
			code: "dependency_not_available",
			message: `Не найдены среди доступных полей: ${missingDependencies.join(", ")}.`
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
	runValidationPass(createSampleRowData(dependencies, 100));
	runValidationPass(createSampleRowData(dependencies, -100));

	const sortedUsedIndexes = toSortedArray(usedIndexes);
	const requiredDependencyCount = sortedUsedIndexes.length > 0 ? sortedUsedIndexes[sortedUsedIndexes.length - 1] + 1 : 0;

	if (outOfRangeIndexes.size > 0) {
		errors.push({
			code: "dependency_index_out_of_range",
			message: `Формула обращается к несуществующим индексам. Минимально требуется зависимостей: ${requiredDependencyCount}, выбрано: ${dependencies.length}.`
		});
	}

	if (sortedUsedIndexes.length === 0) {
		warnings.push({
			code: "formula_does_not_use_dependencies",
			message: "Формула не использует dependencies."
		});
	}

	const unusedDependencies = dependencies.filter((_, index) => !usedIndexes.has(index));
	if (unusedDependencies.length > 0) {
		warnings.push({
			code: "unused_dependencies",
			message: `Выбраны, но не используются формулой: ${unusedDependencies.join(", ")}.`
		});
	}

	if (runtimeErrorCount > 0) {
		warnings.push({
			code: "formula_runtime_error",
			message: "На тестовых данных формула завершилась с ошибкой."
		});
	}

	const usedDependencyIds = sortedUsedIndexes.map((index) => dependencies[index]).filter(Boolean);

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
