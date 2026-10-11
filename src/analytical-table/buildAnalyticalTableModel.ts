import { compileAnalyticalTableDefinition } from "./definition/compileAnalyticalTableDefinition";
import { createAnalyticalTableRuntime } from "./runtime/createAnalyticalTableRuntime";
import { type AnalyticalTableModel, type BuildAnalyticalTableModelOptions } from "./runtime/types";

/**
 * Строит таблицу за один вызов: описание → runtime снимка → модель представления.
 * Для последовательных изменений состояния сохраняйте определение и runtime отдельно.
 */
export function buildAnalyticalTableModel<T>(options: BuildAnalyticalTableModelOptions<T>): AnalyticalTableModel<T> {
	const definition = compileAnalyticalTableDefinition(options);
	const runtime = createAnalyticalTableRuntime({ definition, snapshot: options.snapshot });

	return runtime.getModel(options.state);
}
