import { formatNumberAsInteger } from "./number";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/**
 * Форматирует целые неотрицательные минуты как длительность, а не календарную дату.
 * Сутки всегда равны 24 часам; нулевые остатки сохраняются после старшей единицы.
 * Отсутствующий период обрабатывает потребитель, не подменяя его нулём минут.
 */
export function formatDurationMinutes(minutes: number): string {
	if (!Number.isSafeInteger(minutes) || minutes < 0)
		throw new RangeError("Длительность должна быть неотрицательным безопасным целым числом минут.");

	const remainder = `${formatNumberAsInteger(minutes % MINUTES_PER_HOUR)} мин`;
	if (minutes < MINUTES_PER_HOUR) return remainder;
	const hours = `${formatNumberAsInteger(Math.floor(minutes / MINUTES_PER_HOUR) % 24)} ч`;
	if (minutes < MINUTES_PER_DAY) return `${hours} ${remainder}`;
	return `${formatNumberAsInteger(Math.floor(minutes / MINUTES_PER_DAY))} дн ${hours} ${remainder}`;
}
