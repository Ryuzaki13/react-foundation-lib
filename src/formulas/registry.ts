import { tableFormulaDefinitions } from "./definitions";

import type { TableFormulaDefinition } from "./types";

type TableFormulaRegistry = {
	list: readonly TableFormulaDefinition[];
	byId: ReadonlyMap<string, TableFormulaDefinition>;
};

export function createTableFormulaRegistry(definitions: readonly TableFormulaDefinition[]): TableFormulaRegistry {
	const byId = new Map<string, TableFormulaDefinition>();
	const list: TableFormulaDefinition[] = [];

	for (const definition of definitions) {
		const normalizedId = definition.id.trim();
		if (!normalizedId) {
			throw new Error("Formula v2 id не может быть пустым");
		}

		if (byId.has(normalizedId)) {
			throw new Error(`Найден дублирующийся formulaId в v2: ${normalizedId}`);
		}

		const normalizedDefinition: TableFormulaDefinition = Object.freeze({
			...definition,
			id: normalizedId,
			name: definition.name.trim(),
			description: definition.description.trim(),
			examples: definition.keywords ? [...definition.keywords] : undefined
		});

		byId.set(normalizedId, normalizedDefinition);
		list.push(normalizedDefinition);
	}

	return {
		list: Object.freeze(list),
		byId
	};
}

const tableFormulaRegistry = createTableFormulaRegistry(tableFormulaDefinitions);

export function getTableFormulaList(): readonly TableFormulaDefinition[] {
	return tableFormulaRegistry.list;
}

export function getTableFormulaById(formulaId: string | undefined): TableFormulaDefinition | undefined {
	const normalizedId = formulaId?.trim();
	if (!normalizedId) return undefined;
	return tableFormulaRegistry.byId.get(normalizedId);
}
