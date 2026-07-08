import { formattersPipelineDefinitions } from "./definitions";

import type { FormattersPipelineDefinition } from "./definitions";
import type { FormattersPipelineFormatterId } from "./types";

const formatterDefinitionsById = new Map<FormattersPipelineFormatterId, FormattersPipelineDefinition>(
	formattersPipelineDefinitions.map((definition) => [definition.id, definition])
);

/**
 * Возвращает каталог видов форматтеров pipeline.
 */
export function getFormattersPipelineDefinitions(): readonly FormattersPipelineDefinition[] {
	return formattersPipelineDefinitions;
}

/**
 * Возвращает описание вида форматтера по id.
 */
export function getFormattersPipelineDefinitionById(id: FormattersPipelineFormatterId): FormattersPipelineDefinition | undefined {
	return formatterDefinitionsById.get(id);
}
