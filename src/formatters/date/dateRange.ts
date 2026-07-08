import { getEndOfDay, getStartOfDay } from "./calendarDate";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export type NullableDateRange = readonly [Date | null, Date | null];
export type DateRange = readonly [Date, Date];

export type DateRangeInput = Date | null | NullableDateRange;

export type DateRangeTimeMode = "dayBounds" | "preserve";

export interface NormalizeDateRangeOptions {
	/**
	 * Режим времени для двух граничных дат.
	 *
	 * `dayBounds` расширяет диапазон до полных календарных дней,
	 * `preserve` оставляет время исходных дат после упорядочивания.
	 */
	timeMode?: DateRangeTimeMode;
}

export function isValidDate(value: Date | null): value is Date {
	return value instanceof Date && Number.isFinite(value.getTime());
}

export function isDateRangeTuple(value: DateRangeInput): value is NullableDateRange {
	return Array.isArray(value);
}

export function cloneDate(date: Date): Date {
	return new Date(date.getTime());
}

export function orderDates(left: Date, right: Date): DateRange {
	if (left.getTime() <= right.getTime()) return [left, right];

	return [right, left];
}

export function resolveDateRangePair(value: DateRangeInput): DateRange | null {
	if (isDateRangeTuple(value)) {
		const [left, right] = value;
		const hasLeft = isValidDate(left);
		const hasRight = isValidDate(right);

		if (hasLeft && hasRight) return orderDates(left, right);
		if (hasLeft) return [left, left];
		if (hasRight) return [right, right];

		return null;
	}

	return isValidDate(value) ? [value, value] : null;
}

export function normalizeDateRange(value: DateRangeInput, options: NormalizeDateRangeOptions = {}): DateRange | null {
	const range = resolveDateRangePair(value);
	if (!range) return null;

	const [start, end] = range;
	if (options.timeMode === "preserve") {
		return [cloneDate(start), cloneDate(end)];
	}

	return [getStartOfDay(start), getEndOfDay(end)];
}

export function requireDateRange(value: DateRangeInput, options?: NormalizeDateRangeOptions): DateRange {
	const range = normalizeDateRange(value, options);
	if (!range) {
		throw new Error("Диапазон дат не задан");
	}

	return range;
}

function getCalendarDayTime(date: Date): number {
	return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Считает количество календарных дней в диапазоне включительно.
 */
export function countCalendarDaysInDateRange(value: DateRangeInput): number | null {
	const range = normalizeDateRange(value);
	if (!range) return null;

	const [startDate, endDate] = range;
	return Math.floor((getCalendarDayTime(endDate) - getCalendarDayTime(startDate)) / MS_IN_DAY) + 1;
}
