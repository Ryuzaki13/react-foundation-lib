import { DEFAULT_DATE_LOCALE, DATE_FORMAT_STYLE_MEDIUM } from "./dateFormatConstants";
import { PARSED_DATE_KIND_DATE_TIME } from "./dateValueConstants";
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
	if (!parsed || parsed.kind !== PARSED_DATE_KIND_DATE_TIME) return fallback;

	try {
		return new Intl.DateTimeFormat(options.locale ?? DEFAULT_DATE_LOCALE, {
			dateStyle: options.dateStyle ?? DATE_FORMAT_STYLE_MEDIUM,
			timeStyle: options.timeStyle ?? DATE_FORMAT_STYLE_MEDIUM,
			timeZone: options.timeZone
		}).format(parsed.date);
	} catch {
		return fallback;
	}
}
