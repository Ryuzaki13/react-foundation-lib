import { State } from "../../types";

import { ValueStateResolver } from "./types";

/** Реестр: id → скомпилированная функция-резолвер */
const resolverRegistry = new Map<string, ValueStateResolver>();

/** Обратный индекс: каноническая строка конфигурации → id (дедупликация) */
const configToIdIndex = new Map<string, string>();

/**
 * Вычислить короткий хеш из строки (djb2 → base36).
 * Результат — строка вида `"id_1a2b3c4"`.
 */
export function computeShortHash(input: string): string {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
	}
	return "id_" + hash.toString(36);
}

/**
 * Зарегистрировать резолвер в общем реестре.
 * Если конфигурация с таким каноническим ключом уже есть — вернуть существующий id.
 * Возвращает `{ id, isNew }`.
 */
export function registerResolver(canonicalKey: string, compileFunction: () => ValueStateResolver): { id: string; isNew: boolean } {
	const existingId = configToIdIndex.get(canonicalKey);
	if (existingId) return { id: existingId, isNew: false };

	const id = computeShortHash(canonicalKey);
	const resolver = compileFunction();

	resolverRegistry.set(id, resolver);
	configToIdIndex.set(canonicalKey, id);

	return { id, isNew: true };
}

/**
 * Найти существующий резолвер по каноническому ключу.
 * Возвращает `undefined`, если не найден.
 */
export function findResolverByCanonicalKey(canonicalKey: string): ValueStateResolver | undefined {
	const id = configToIdIndex.get(canonicalKey);
	if (!id) return undefined;
	return resolverRegistry.get(id);
}

/**
 * Применить зарегистрированный резолвер к значению.
 * Если резолвер с указанным `id` не найден — возвращает `"none"`.
 *
 * @example
 * ```ts
 * resolveValueState("v_1a2b3c4", 75); // → "success"
 * ```
 */
export function resolveValueState(id: string, value: unknown): State {
	const resolver = resolverRegistry.get(id);
	if (!resolver) return "none";
	return resolver(value);
}

/**
 * Получить функцию-резолвер по `id`.
 * Возвращает `undefined`, если резолвер не зарегистрирован.
 */
export function getValueStateResolver(id: string): ValueStateResolver | undefined {
	return resolverRegistry.get(id);
}

/**
 * Получить список всех зарегистрированных id.
 */
export function getValueStateResolverIds(): string[] {
	return Array.from(resolverRegistry.keys());
}

/**
 * Полная очистка реестра. Предназначена для тестов.
 */
export function resetValueStateResolvers(): void {
	resolverRegistry.clear();
	configToIdIndex.clear();
}
