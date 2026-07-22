import type { RowBasedFormatterDefinition } from "./types";

export type RowBasedFormatterRegistry = Readonly<{
	list: readonly RowBasedFormatterDefinition[];
	byId: ReadonlyMap<string, RowBasedFormatterDefinition>;
}>;

/**
 * Создаёт реестр формул для подмены значения в групповой строке.
 */
export function createRowBasedFormatterRegistry(definitions: readonly RowBasedFormatterDefinition[]): RowBasedFormatterRegistry {
	const byId = new Map<string, RowBasedFormatterDefinition>();
	const list: RowBasedFormatterDefinition[] = [];

	for (const definition of definitions) {
		const normalizedId = definition.id.trim();
		if (!normalizedId) {
			throw new Error("Formula id для RowBasedFormatter не может быть пустым");
		}

		if (byId.has(normalizedId)) {
			throw new Error(`Найден дублирующийся formulaId в RowBasedFormatter: ${normalizedId}`);
		}

		const normalizedDefinition: RowBasedFormatterDefinition = Object.freeze({
			...definition,
			id: normalizedId,
			name: definition.name.trim(),
			description: definition.description.trim()
		});

		byId.set(normalizedId, normalizedDefinition);
		list.push(normalizedDefinition);
	}

	return Object.freeze({
		list: Object.freeze(list),
		byId
	});
}

let rowBasedFormatterRegistry = createRowBasedFormatterRegistry([]);

/**
 * Устанавливает реестр row-based форматтеров host-приложения.
 *
 * Pipeline использует этот реестр при валидации и компиляции formula-режима,
 * поэтому конфигурация должна завершиться до первого построения runtime.
 */
export function configureRowBasedFormatterRegistry(registry: RowBasedFormatterRegistry): void {
	rowBasedFormatterRegistry = registry;
}

/**
 * Возвращает список доступных формул для групповой подмены.
 */
export function getRowBasedFormatterList(): readonly RowBasedFormatterDefinition[] {
	return rowBasedFormatterRegistry.list;
}

/**
 * Возвращает формулу по id.
 */
export function getRowBasedFormatterById(formulaId: string | undefined): RowBasedFormatterDefinition | undefined {
	const normalizedId = formulaId?.trim();
	if (!normalizedId) return undefined;
	return rowBasedFormatterRegistry.byId.get(normalizedId);
}
