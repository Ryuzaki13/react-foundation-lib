/**
 * Детерминированная JSON-сериализация: ключи объектов сортируются по алфавиту.
 *
 * Зачем: стандартный `JSON.stringify` не гарантирует порядок ключей,
 * что делает его непригодным для кэш-ключей и сравнений на равенство.
 */
export function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_k, v) => {
		if (!v || typeof v !== "object") return v;

		if (Array.isArray(v)) return v;

		// Дата -> ISO (на всякий случай)
		if (v instanceof Date) return v.toISOString();

		const obj = v as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(obj).sort()) out[key] = obj[key];
		return out;
	});
}
