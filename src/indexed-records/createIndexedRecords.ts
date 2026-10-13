import { type IndexedRecords } from "./indexedRecordsTypes";

/**
 * Строит позиционный индекс одним проходом при создании нового снимка.
 * Не копирует и не замораживает чужой массив или его записи. Владелец снимка
 * переиспользует результат; повторный вызов намеренно строит новый индекс.
 */
export function createIndexedRecords<T>(items: readonly T[], getId: (item: T) => string): IndexedRecords<T> {
	// У словаря нет prototype: __proto__, constructor и другие строковые IDs
	// являются обычными собственными ключами и не меняют его устройство.
	const indexById = Object.create(null) as Record<string, number>;
	let index = 0;
	for (const item of items) {
		const id = getId(item);
		if (Object.hasOwn(indexById, id)) throw new Error("Повторный идентификатор в индексированных записях.");
		indexById[id] = index;
		index += 1;
	}
	// Защищаем только собственную metadata; глубокого freeze и обхода записей нет.
	return Object.freeze({ items, indexById: Object.freeze(indexById) });
}
