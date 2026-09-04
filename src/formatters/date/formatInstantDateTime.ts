import { parseDateValueTZ } from "./parseDate";

/**
 * Настройки отображения абсолютного момента в явно заданном часовом поясе.
 * Обязательный `timeZone` исключает зависимость результата от часового пояса
 * браузера или SSR-сервера.
 */
export type FormatInstantDateTimeOptions = {
	readonly timeZone: string;
	readonly locale?: string;
	readonly dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
	readonly timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
	readonly fallback?: string;
};

/**
 * Форматирует ISO/OData/Unix timestamp как абсолютный момент в указанном
 * часовом поясе IANA. Используется для времени событий и аудита; календарные
 * значения без часового пояса следует форматировать через обычный `formatDate`.
 */
export function formatInstantDateTime(value: unknown, options: FormatInstantDateTimeOptions): string {
	const parsed = parseDateValueTZ(value);
	const fallback = options.fallback ?? "";
	if (!parsed || parsed.kind !== "date-time") return fallback;

	try {
		return new Intl.DateTimeFormat(options.locale ?? "ru-RU", {
			dateStyle: options.dateStyle ?? "medium",
			timeStyle: options.timeStyle ?? "medium",
			timeZone: options.timeZone
		}).format(parsed.date);
	} catch {
		return fallback;
	}
}
