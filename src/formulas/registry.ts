import type { TableFormulaDefinition } from "./types";

export type TableFormulaRegistry = Readonly<{
	list: readonly TableFormulaDefinition[];
	byId: ReadonlyMap<string, TableFormulaDefinition>;
}>;

export function createTableFormulaRegistry(definitions: readonly TableFormulaDefinition[]): TableFormulaRegistry {
	const byId = new Map<string, TableFormulaDefinition>();
	const list: TableFormulaDefinition[] = [];

	for (const definition of definitions) {
		const normalizedId = definition.id.trim();
		if (!normalizedId) {
			throw new Error("Formula id не может быть пустым");
		}

		if (byId.has(normalizedId)) {
			throw new Error(`Найден дублирующийся formulaId: ${normalizedId}`);
		}

		const normalizedDefinition: TableFormulaDefinition = Object.freeze({
			...definition,
			id: normalizedId,
			name: definition.name.trim(),
			description: definition.description.trim(),
			keywords: definition.keywords ? [...definition.keywords] : undefined
		});

		byId.set(normalizedId, normalizedDefinition);
		list.push(normalizedDefinition);
	}

	return Object.freeze({
		list: Object.freeze(list),
		byId
	});
}

let tableFormulaRegistry = createTableFormulaRegistry([]);

/**
 * Устанавливает реестр формул host-приложения для всех formula runtime API.
 *
 * Конфигурация выполняется composition root до первого чтения, валидации или
 * компиляции формулы. Библиотека намеренно не содержит прикладной каталог.
 */
export function configureTableFormulaRegistry(registry: TableFormulaRegistry): void {
	tableFormulaRegistry = registry;
}

export function getTableFormulaList(): readonly TableFormulaDefinition[] {
	return tableFormulaRegistry.list;
}

export function getTableFormulaById(formulaId: string | undefined): TableFormulaDefinition | undefined {
	const normalizedId = formulaId?.trim();
	if (!normalizedId) return undefined;
	return tableFormulaRegistry.byId.get(normalizedId);
}
