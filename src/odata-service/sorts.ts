export interface Sort<T> {
	key: T;
	/**
	 * @default false (asc)
	 */
	desc?: true;
}

export function getSortIndex<T>(sorting: Sort<keyof T>[], key: keyof T): number {
	return sorting.findIndex((s) => s.key === key);
}

export function buildODataOrder<T>(sorting: Sort<keyof T>[]): string {
	return sorting.map((s) => `${String(s.key)} ${s.desc ? "desc" : "asc"}`).join(",");
}

export function toggleSort<T>(sorting: Sort<keyof T>[], key: keyof T, multi: boolean): Sort<keyof T>[] {
	const idx = getSortIndex(sorting, key);

	// single-sort: начинаем с чистого массива (кроме клика по уже существующему — тоже можно сбрасывать)
	const base = multi ? [...sorting] : [...sorting.filter((s) => s.key === key)];

	if (idx === -1) {
		base.push({ key });
		return base;
	}

	const current = sorting[idx]!;
	if (!current.desc) {
		// asc -> desc
		return base.map((s) => (s.key === key ? { key, desc: true } : s));
	}

	// desc -> remove
	return base.filter((s) => s.key !== key);
}

/**
 * Возвращает эффективный набор сортировок для аналитической таблицы.
 *
 * Правило:
 * - при наличии пользовательской сортировки используется только она;
 * - если пользовательская сортировка отсутствует, используется сортировка по полям группировки (asc).
 */
export function resolveEffectiveSorts<TKey extends PropertyKey>(grouping: TKey[], sorting: Sort<TKey>[]): Sort<TKey>[] {
	if (sorting.length > 0) {
		return sorting.map((item) => ({ key: item.key, desc: item.desc }));
	}

	return grouping.map((key) => ({ key }));
}

export function buildODataOrderBy<T>(grouping: (keyof T)[], sorting: Sort<keyof T>[]): string | undefined {
	const effectiveSorting = resolveEffectiveSorts(grouping, sorting);
	const parts = effectiveSorting.map((item) => `${String(item.key)} ${item.desc ? "desc" : "asc"}`);

	return parts.length ? parts.join(",") : undefined;
}

export function getSortIndicator<T>(
	grouping: (keyof T)[],
	sorting: Sort<keyof T>[],
	colId: keyof T
): { active: boolean; desc?: boolean; order?: number; lockedByGrouping?: boolean } {
	const hasUserSorting = sorting.length > 0;
	const gIdx = grouping.indexOf(colId);
	if (!hasUserSorting && gIdx !== -1) {
		return { active: true, order: gIdx + 1, lockedByGrouping: true };
	}

	const sIdx = sorting.findIndex((s) => s.key === colId);
	if (sIdx === -1) return { active: false };

	return { active: true, desc: sorting[sIdx]?.desc, order: sIdx + 1 };
}
