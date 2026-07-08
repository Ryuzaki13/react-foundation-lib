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
		id: "normalizeLeadingZeros",
		name: "Нормализация ведущих нулей",
		description: "Нормализует числовое значение по правилам fixed."
	},
	{
		id: "rowBasedOverride",
		name: "Контекстная формула",
		description: "Подменяет значение из другого поля текущей строки или отдельной формулы."
	},
	{
		id: "resolveValueState",
		name: "Определение состояния значения",
		description: "Вычисляет value state и опционально настраивает отображение статусной иконки."
	},
	{
		id: "typedValueFormat",
		name: "Типизированное форматирование",
		description: "Формирует итоговый внешний вид значения по типу и роли столбца."
	}
]);
