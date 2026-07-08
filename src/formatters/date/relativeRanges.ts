import { addCalendarDays, addCalendarMonths, getEndOfDay, getStartOfDay, getStartOfMonth } from "./calendarDate";

import type { NullableDateRange } from "./dateRange";

/**
 * Контекст вычисления относительного диапазона дат.
 */
export interface DateRangeReferenceContext {
	referenceDate: Date;
}

/**
 * Нормализует опорную дату к началу суток без timezone-сдвига.
 */
export function normalizeDateRangeReferenceDate(referenceDate: Date): Date {
	return getStartOfDay(referenceDate);
}

/**
 * Возвращает безопасную конечную дату для диапазона "с начала месяца по вчера".
 *
 * На первом дне месяца диапазон не может закончиться "вчера" без инверсии,
 * поэтому конец диапазона прижимается к старту месяца.
 */
export function resolveMonthStartToYesterdayRange({ referenceDate }: DateRangeReferenceContext): NullableDateRange {
	const normalizedReferenceDate = normalizeDateRangeReferenceDate(referenceDate);
	const monthStart = getStartOfMonth(normalizedReferenceDate);
	const yesterday = addCalendarDays(normalizedReferenceDate, -1);
	const safeEndDate = yesterday < monthStart ? monthStart : yesterday;

	return [monthStart, getEndOfDay(safeEndDate)];
}

/**
 * Возвращает диапазон "с начала месяца по сегодня".
 */
export function resolveMonthStartToTodayRange({ referenceDate }: DateRangeReferenceContext): NullableDateRange {
	const normalizedReferenceDate = normalizeDateRangeReferenceDate(referenceDate);
	return [getStartOfMonth(normalizedReferenceDate), getEndOfDay(normalizedReferenceDate)];
}

/**
 * Возвращает диапазон "за сегодня".
 */
export function resolveTodayRange({ referenceDate }: DateRangeReferenceContext): NullableDateRange {
	const normalizedReferenceDate = normalizeDateRangeReferenceDate(referenceDate);
	return [normalizedReferenceDate, getEndOfDay(normalizedReferenceDate)];
}

/**
 * Возвращает диапазон "за вчера".
 */
export function resolveYesterdayRange({ referenceDate }: DateRangeReferenceContext): NullableDateRange {
	const yesterday = addCalendarDays(normalizeDateRangeReferenceDate(referenceDate), -1);
	return [yesterday, getEndOfDay(yesterday)];
}

/**
 * Возвращает диапазон "месяц назад" от текущего дня.
 */
export function resolveMonthAgoRange({ referenceDate }: DateRangeReferenceContext): NullableDateRange {
	const normalizedReferenceDate = normalizeDateRangeReferenceDate(referenceDate);
	const monthAgo = addCalendarMonths(normalizedReferenceDate, -1);
	return [getStartOfDay(monthAgo), getEndOfDay(normalizedReferenceDate)];
}
