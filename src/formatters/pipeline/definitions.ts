import {
	PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
	PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
	PIPELINE_FORMATTER_RESOLVE_VALUE_STATE,
	PIPELINE_FORMATTER_TYPED_VALUE_FORMAT
} from "./formattersPipelineConstants";

import type { FormattersPipelineFormatterId } from "./types";

/**
 * Описание вида форматтера для каталога.
 */
export type FormattersPipelineDefinition = {
	id: FormattersPipelineFormatterId;
	name: string;
	description: string;
};

/**
 * Справочник доступных видов форматтеров.
 */
export const formattersPipelineDefinitions: readonly FormattersPipelineDefinition[] = Object.freeze([
	{
		id: PIPELINE_FORMATTER_NORMALIZE_LEADING_ZEROS,
		name: "Нормализация ведущих нулей",
		description: "Нормализует числовое значение по правилам fixed."
	},
	{
		id: PIPELINE_FORMATTER_ROW_BASED_OVERRIDE,
		name: "Контекстная формула",
		description: "Подменяет значение из другого поля текущей строки или отдельной формулы."
	},
	{
		id: PIPELINE_FORMATTER_RESOLVE_VALUE_STATE,
		name: "Определение состояния значения",
		description: "Вычисляет value state и опционально настраивает отображение статусной иконки."
	},
	{
		id: PIPELINE_FORMATTER_TYPED_VALUE_FORMAT,
		name: "Типизированное форматирование",
		description: "Формирует итоговый внешний вид значения по типу и роли столбца."
	}
]);
