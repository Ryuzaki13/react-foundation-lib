import { type IndexedRecords } from "./indexedRecordsTypes";

/**
 * Адресный lookup возвращает исходную запись, не создавая view model или копию.
 * Собственный ключ проверяется и после восстановления обычного JSON-объекта:
 * у восстановленного словаря может снова появиться стандартный prototype.
 * Проверка недоверенного wire snapshot остаётся у принимающей границы.
 */
export function getIndexedRecord<T>(records: IndexedRecords<T>, id: string): T | undefined {
	if (!Object.hasOwn(records.indexById, id)) return undefined;
	return records.items[records.indexById[id]];
}
