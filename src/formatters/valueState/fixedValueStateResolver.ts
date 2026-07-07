import { compareStrings } from "../../string-comparison";
import { State } from "../../types";

import { FixedValueStateResolverConfig, ValueStateResolver } from "./types";
import { findResolverByCanonicalKey, registerResolver } from "./valueStateRegistry";

/** Создать каноническую строку конфигурации (с префиксом типа для изоляции от пороговых резолверов) */
function createCanonicalKey(sortedEntries: [string, State][], fallbackState: State): string {
	const entriesPart = sortedEntries.map(([key, state]) => `${key}:${state}`).join(",");
	return `fixed|${entriesPart}|${fallbackState}`;
}

/** Скомпилировать функцию-резолвер из маппинга */
function compileFixedResolver(entries: Record<string, State>, fallbackState: State): ValueStateResolver {
	const lookup = new Map<string, State>(Object.entries(entries));

	return (value: unknown): State => {
		if (value === null || value === undefined) return fallbackState;

		const key = String(value);
		return lookup.get(key) ?? fallbackState;
	};
}

/** Нормализовать конфигурацию и вернуть подготовленные данные */
function prepareConfig(config: FixedValueStateResolverConfig) {
	const fallbackState: State = config.fallbackState ?? "none";

	// Сортировка ключей для детерминированного канонического ключа
	const sortedEntries = Object.entries(config.entries).sort(([a], [b]) => compareStrings(a, b)) as [string, State][];

	const canonicalKey = createCanonicalKey(sortedEntries, fallbackState);

	return { entries: config.entries, fallbackState, canonicalKey };
}

/**
 * Зарегистрировать фиксированный резолвер из конфигурации.
 * Возвращает короткий уникальный `id`.
 *
 * Фиксированный резолвер определяет State по точному совпадению значения ячейки
 * со значениями из маппинга `entries`.
 *
 * @example
 * ```ts
 * const id = registerFixedResolver({
 *   entries: {
 *     "01": "success",
 *     "02": "warning",
 *     "03": "error",
 *   },
 *   fallbackState: "none",
 * });
 *
 * // В ячейке: resolveValueState(id, cellValue)
 * ```
 */
export function registerFixedResolver(config: FixedValueStateResolverConfig): string {
	const { entries, fallbackState, canonicalKey } = prepareConfig(config);

	const { id } = registerResolver(canonicalKey, () => compileFixedResolver(entries, fallbackState));

	return id;
}

/**
 * Создать фиксированный резолвер напрямую.
 * Резолвер регистрируется в общем реестре.
 * Идентичные конфигурации возвращают одну и ту же функцию.
 *
 * @example
 * ```ts
 * const resolve = createFixedResolver({
 *   entries: { "01": "success", "02": "warning", "03": "error" },
 * });
 *
 * resolve("01");  // → "success"
 * resolve("02");  // → "warning"
 * resolve("99");  // → "none" (fallback)
 * ```
 */
export function createFixedResolver(config: FixedValueStateResolverConfig): ValueStateResolver {
	const { entries, fallbackState, canonicalKey } = prepareConfig(config);

	const existing = findResolverByCanonicalKey(canonicalKey);
	if (existing) return existing;

	registerResolver(canonicalKey, () => compileFixedResolver(entries, fallbackState));

	return findResolverByCanonicalKey(canonicalKey)!;
}
