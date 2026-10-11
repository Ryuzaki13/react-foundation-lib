import { type AnalyticalViewState } from "../runtime/types";

import { type CompiledAnalyticalTableDefinition } from "./types";

/** Состояние ссылается на проверенное описание; grouping keys могут быть служебными полями values. */
export function validateAnalyticalView<T>(definition: CompiledAnalyticalTableDefinition<T>, state: AnalyticalViewState): void {
	for (const entry of [...(state.sorting ?? []), ...(state.filters ?? [])]) {
		if (!definition.fieldsById.has(entry.id)) {
			throw new Error(`Неизвестный аналитический столбец: ${entry.id}`);
		}
	}

	const levelIds = new Set<string>();
	for (const level of state.grouping ?? []) {
		if (levelIds.has(level.id)) {
			throw new Error("Идентификаторы уровней группировки должны быть уникальны.");
		}
		if (level.keyColumnIds.length === 0) {
			throw new Error(`Уровень ${level.id} не содержит ключей группировки.`);
		}
		levelIds.add(level.id);
	}
}
