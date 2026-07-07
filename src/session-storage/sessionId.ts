import { uuidv4 } from "../crypto";

/**
 * Возвращает стабильный идентификатор вкладочной сессии из sessionStorage.
 *
 * Helper общий для модулей, которым нужно сгруппировать события в рамках одной
 * вкладки без долгоживущего пользовательского идентификатора.
 */
export function getSessionStorageId(key: string, createId: () => string = uuidv4) {
	if (typeof sessionStorage === "undefined") return createId();

	try {
		const existing = sessionStorage.getItem(key);
		if (existing) return existing;

		const next = createId();
		sessionStorage.setItem(key, next);
		return next;
	} catch {
		return createId();
	}
}
