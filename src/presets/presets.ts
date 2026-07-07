/**
 * Минимальный контракт пресета для UI-контролов и чистых resolver-ов.
 */
export type PresetOption<TId extends string = string> = {
	id: TId;
	label: string;
};

/**
 * Нормализует сохраненный список id пресетов через доменный type guard.
 */
export function normalizePresetIds<TId extends string>(
	value: unknown,
	isPresetId: (value: unknown) => value is TId,
	fallbackIds: readonly TId[] = []
): TId[] {
	if (!Array.isArray(value)) {
		return [...fallbackIds];
	}

	const presetIds: TId[] = [];

	for (const item of value) {
		if (!isPresetId(item) || presetIds.includes(item)) {
			continue;
		}

		presetIds.push(item);
	}

	return presetIds;
}

/**
 * Формирует список пресетов по сохраненным id, сохраняя порядок и удаляя дубли.
 */
export function resolvePresetOptionsByIds<TOption extends PresetOption>(
	presetIds: readonly TOption["id"][],
	options: readonly TOption[]
): TOption[] {
	const optionsById = new Map(options.map((option) => [option.id, option]));
	const resolvedOptions: TOption[] = [];
	const addedIds = new Set<TOption["id"]>();

	for (const presetId of presetIds) {
		if (addedIds.has(presetId)) {
			continue;
		}

		const option = optionsById.get(presetId);
		if (!option) {
			continue;
		}

		resolvedOptions.push(option);
		addedIds.add(presetId);
	}

	return resolvedOptions;
}

/**
 * Ищет пресет по id.
 */
export function getPresetOption<TOption extends PresetOption>(
	id: TOption["id"] | null | undefined,
	options: readonly TOption[]
): TOption | null {
	if (!id) return null;
	return options.find((option) => option.id === id) ?? null;
}
