import { type ValueTransformerDefinition } from "./types";

export type ValueTransformerRegistry = Readonly<{
	list: readonly ValueTransformerDefinition[];
	byId: ReadonlyMap<string, ValueTransformerDefinition>;
}>;

/** Создаёт независимый каталог с устойчивыми ID и неизменяемыми метаданными. */
export function createValueTransformerRegistry(definitions: readonly ValueTransformerDefinition[]): ValueTransformerRegistry {
	const byId = new Map<string, ValueTransformerDefinition>();
	const list: ValueTransformerDefinition[] = [];

	for (const definition of definitions) {
		const id = definition.id.trim();
		if (!id) throw new Error("ID преобразования значения не может быть пустым.");
		if (byId.has(id)) throw new Error(`Найден дублирующийся transformerId: ${id}.`);

		const normalizedDefinition: ValueTransformerDefinition = Object.freeze({
			...definition,
			id,
			name: definition.name.trim(),
			description: definition.description.trim(),
			...(definition.keywords === undefined ? {} : { keywords: Object.freeze([...definition.keywords]) })
		});
		byId.set(id, normalizedDefinition);
		list.push(normalizedDefinition);
	}

	return Object.freeze({ list: Object.freeze(list), byId });
}

let valueTransformerRegistry = createValueTransformerRegistry([]);

/**
 * Устанавливает каталог host-приложения до первого чтения или компиляции.
 * Библиотека предоставляет механизм и не регистрирует прикладные преобразования.
 */
export function configureValueTransformerRegistry(registry: ValueTransformerRegistry): void {
	valueTransformerRegistry = registry;
}

export function getValueTransformerList(): readonly ValueTransformerDefinition[] {
	return valueTransformerRegistry.list;
}

export function getValueTransformerById(transformerId: string | undefined): ValueTransformerDefinition | undefined {
	const id = transformerId?.trim();
	return id ? valueTransformerRegistry.byId.get(id) : undefined;
}
