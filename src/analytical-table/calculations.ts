import { arrayDeduplicate } from "../array";
import { compileTableFormula } from "../formulas";

import { type AnalyticalCalculationPlan, type AnalyticalCalculationStep, type AnalyticalColumn, type AnalyticalValues } from "./types";

/** Проверяет граф зависимостей до расчёта строк и компилирует каждую формулу один раз. */
export function createAnalyticalCalculationPlan<T>(
	columns: readonly AnalyticalColumn<T>[],
	requiredColumnIds: readonly string[] = columns.map((column) => column.id)
): AnalyticalCalculationPlan {
	const byId = new Map(columns.map((column) => [column.id, column]));
	if (byId.size !== columns.length) throw new Error("Идентификаторы аналитических столбцов должны быть уникальны.");
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const required: string[] = [];
	const steps: AnalyticalCalculationStep[] = [];
	const visit = (id: string): void => {
		if (visited.has(id)) return;
		if (visiting.has(id)) throw new Error(`Циклическая зависимость аналитического столбца: ${id}`);
		const column = byId.get(id);
		if (!column) throw new Error(`Неизвестная зависимость аналитического столбца: ${id}`);
		if (column.formula && column.calculate) throw new Error(`Столбец ${id} содержит два способа вычисления.`);
		visiting.add(id);
		const dependencies = arrayDeduplicate(column.formula?.dependencies ?? column.calculate?.dependencies ?? []);
		for (const dependency of dependencies) visit(dependency);
		if (column.formula) {
			// Порядок и повторы аргументов формулы сохраняются; уникален лишь граф зависимостей.
			const compiled = compileTableFormula({ formulaId: column.formula.formulaId, keys: column.formula.dependencies });
			if (!compiled.ok) throw new Error(`Формула столбца ${id} не зарегистрирована: ${column.formula.formulaId}`);
			steps.push({
				columnId: id,
				dependencies,
				compute: (values) => {
					const result = compiled.execute({ ...values });
					if (!result.ok) throw new Error(`Ошибка формулы столбца ${id}: ${result.reason}`);
					return result.value;
				}
			});
		} else if (column.calculate) {
			steps.push({ columnId: id, dependencies, compute: column.calculate.compute });
		}
		visiting.delete(id);
		visited.add(id);
		required.push(id);
	};
	for (const id of requiredColumnIds) visit(id);
	return { steps, requiredColumnIds: required };
}

/** Возвращает отдельный набор значений; исходный DTO и значения Query не мутируются. */
export function calculateAnalyticalValues(values: AnalyticalValues, plan: AnalyticalCalculationPlan): AnalyticalValues {
	const result: Record<string, unknown> = { ...values };
	for (const step of plan.steps) result[step.columnId] = step.compute(result);
	return result;
}
