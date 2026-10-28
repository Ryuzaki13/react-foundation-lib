import { type AsyncStorage, type PersistedQuery } from "@tanstack/query-persist-client-core";
import { isCancelledError } from "@tanstack/react-query";

import { type QueryRestoreStorageOptions } from "./queryRestoreStorageTypes";

const SYNCHRONOUS_PARSER_REQUIRED_MESSAGE = "Parser восстановленных Query data должен синхронно вернуть значение.";

/**
 * Проверяет только адресное чтение пригодной persisted записи. Сбой возникает
 * до upstream timestamp/refetch scheduler; remove и network fallback остаются
 * у persister. Обход storage entries и GC сохраняют прежнее поведение.
 */
export function createQueryRestoreStorage({
	storage,
	queryHash,
	prefix,
	buster,
	maxAge,
	parser,
	assertCurrentRestore
}: QueryRestoreStorageOptions): AsyncStorage<PersistedQuery> {
	return {
		...storage,
		removeItem: (key) => {
			try {
				assertCurrentRestore();
			} catch (error) {
				// Upstream удаляет запись при любой restore error. Отмена потребителя
				// не доказывает повреждение и не должна уничтожать рабочий снимок.
				if (isCancelledError(error)) return;
				throw error;
			}
			return storage.removeItem(key);
		},
		getItem: async (key) => {
			const stored = await storage.getItem(key);
			if (!stored) return stored;
			assertCurrentRestore();
			if (key !== `${prefix}-${queryHash}` || stored.queryHash !== queryHash) {
				throw new Error("Persisted запись не соответствует восстанавливаемой Query identity.");
			}
			const updatedAt = stored.state?.dataUpdatedAt;
			// Два скалярных условия совпадают с upstream eligibility gate. Истёкшее
			// содержимое не проходит дорогой parser; удалением владеет persister.
			if (!updatedAt || Date.now() - updatedAt > maxAge || stored.buster !== buster) return stored;
			if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) {
				throw new Error("Persisted запись содержит некорректное время обновления.");
			}
			const parsed = parser(stored.state.data);
			const isThenable =
				(typeof parsed === "object" || typeof parsed === "function") &&
				parsed !== null &&
				typeof Reflect.get(parsed, "then") === "function";
			if (isThenable) {
				// Недопустимая async работа могла уже начаться. Её rejection поглощён,
				// а нарушение sync-контракта передаётся persister как обычная ошибка.
				void Promise.resolve(parsed).catch(() => undefined);
				throw new TypeError(SYNCHRONOUS_PARSER_REQUIRED_MESSAGE);
			}
			if (parsed === undefined) {
				throw new TypeError(SYNCHRONOUS_PARSER_REQUIRED_MESSAGE);
			}
			assertCurrentRestore();
			// Копируются только оболочки, записи остаются результатом одного parser.
			return { ...stored, state: { ...stored.state, data: parsed } };
		}
	};
}
