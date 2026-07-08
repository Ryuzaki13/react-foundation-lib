import { normalizeText } from "../formatters/strings";

export function arrayGroupBy<T>(array: readonly T[], key: keyof T): Record<string, T[]> {
	return array.reduce<Record<string, T[]>>((acc, item) => {
		const groupKey = String(item[key]);
		(acc[groupKey] ||= []).push(item);
		return acc;
	}, {});
}

export function arrayToMap<T>(array: readonly T[], key: keyof T): Record<string, T> {
	return array.reduce<Record<string, T>>((acc, item) => {
		const groupKey = String(item[key]);
		if (!acc[groupKey]) {
			acc[groupKey] = item;
		}
		return acc;
	}, {});
}

export function arrayGroupByToArray<T>(array: readonly T[], key: keyof T): Array<{ key: string; items: T[] }> {
	const grouped = array.reduce<Record<string, T[]>>((acc, item) => {
		const groupKey = String(item[key]);
		(acc[groupKey] ||= []).push(item);
		return acc;
	}, {});

	return Object.entries(grouped).map(([key, items]) => ({
		key,
		items
	}));
}

export function arrayUniqueBy<T>(array: readonly T[], key: keyof T): T[] {
	const seen = new Set<string>();
	return array.filter((item) => {
		const value = String(item[key]);
		if (seen.has(value)) return false;
		seen.add(value);
		return true;
	});
}

/**
 * Удаляет дубликаты из массива с сохранением первого вхождения.
 *
 * Нужна для нормализации списков примитивных значений перед передачей
 * в кеш-ключи, SQL-запросы и другие слои, где повторные элементы не несут смысла.
 */
export function arrayDeduplicate<T>(array: readonly T[]): T[] {
	const out: T[] = [];
	const seen = new Set<T>();

	for (const item of array) {
		if (seen.has(item)) continue;

		seen.add(item);
		out.push(item);
	}

	return out;
}

/**
 * Фильтрует массив идентификаторов: оставляет только присутствующие в `allowedIds`,
 * удаляет дубликаты, исключает пустые строки.
 *
 * Зачем: унификация нормализации пользовательских списков ID
 * (grouped columns, locked visible columns и т.п.) перед вычислением layout.
 */
export function filterAndDeduplicateIds<TId extends string>(ids: readonly string[] | undefined, allowedIds: readonly TId[]): TId[] {
	const known = new Map<string, TId>(allowedIds.map((id) => [id, id]));
	const out: TId[] = [];
	const seen = new Set<string>();

	for (const id of ids ?? []) {
		if (!id || seen.has(id)) continue;
		const knownId = known.get(id);
		if (!knownId) continue;
		seen.add(id);
		out.push(knownId);
	}

	return out;
}

export function appendMissingIds<TId extends string>(baseIds: readonly TId[], idsToAppend: readonly TId[]): TId[] {
	const out = [...baseIds];
	const seen = new Set(baseIds);

	for (const id of idsToAppend) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}

	return out;
}

export function pickExistingMapValues<TKey, TValue>(keys: readonly TKey[], valuesByKey: ReadonlyMap<TKey, TValue>): TValue[] {
	const out: TValue[] = [];

	for (const key of keys) {
		const value = valuesByKey.get(key);

		if (value !== undefined) {
			out.push(value);
		}
	}

	return out;
}

export function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
	if (left.length !== right.length) return false;

	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) return false;
	}

	return true;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
	if (from === to) return [...items];
	if (from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];

	const next = [...items];
	const [item] = next.splice(from, 1);
	if (item === undefined) return [...items];
	next.splice(to, 0, item);

	return next;
}

export function normalizeObjects<T, K extends keyof T, O = T>(
	items: readonly T[] | undefined,
	key: K,
	copyist?: ((item: T, key: T[K]) => O) | false
): O[] | undefined {
	if (!items) return undefined;

	const out: O[] = [];
	const seen = new Set<T[K]>();
	const copyFn = (() => {
		if (typeof copyist === "boolean" && copyist === false) {
			return (item: T): O => item as unknown as O;
		}
		if (typeof copyist === "function") {
			return copyist;
		}
		return (item: T): O => ({ ...item }) as unknown as O;
	})();

	for (const item of items) {
		const normalizedKey = normalizeText(item[key]) as T[K];
		if (!normalizedKey || seen.has(normalizedKey)) continue;
		seen.add(normalizedKey);
		out.push(copyFn(item, normalizedKey));
	}

	return out.length ? out : undefined;
}

export function normalizeStringArray(items: readonly string[] | undefined): string[] | undefined {
	if (!items?.length) return undefined;

	const out: string[] = [];
	const seen = new Set<string>();

	for (const item of items) {
		const value = item.trim();
		if (!value || seen.has(value)) continue;

		seen.add(value);
		out.push(value);
	}

	return out.length ? out : undefined;
}

export function addUnique(target: string[], seen: Set<string>, fieldId: string | undefined): void {
	const normalizedId = fieldId?.trim();
	if (!normalizedId || seen.has(normalizedId)) return;
	seen.add(normalizedId);
	target.push(normalizedId);
}
