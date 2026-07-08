import {
	addCalendarDays,
	createCalendarDate,
	getEndOfDay,
	getStartOfDay,
	getStartOfMonth,
	getStartOfWeek,
	getStartOfYear
} from "./calendarDate";

export type CalendarPeriodSelectionMode = "day" | "week" | "month" | "year";
export type CalendarWeekEndDay = "friday" | "saturday" | "sunday";

export interface CalendarPeriodOptions {
	/**
	 * Определяет размер выбираемого календарного периода.
	 */
	selectionMode?: CalendarPeriodSelectionMode;
	/**
	 * Последний включённый день недели для режима `week`.
	 */
	weekEndDay?: CalendarWeekEndDay;
}

export interface CalendarPeriod {
	readonly start: Date;
	readonly end: Date;
}

export interface CalendarPeriodDateBounds {
	readonly minDate?: Date;
	readonly maxDate?: Date;
}

const WEEK_END_DAY_OFFSETS: Record<CalendarWeekEndDay, number> = {
	friday: 4,
	saturday: 5,
	sunday: 6
};

function isValidCalendarDate(value: Date | null | undefined): value is Date {
	return value instanceof Date && Number.isFinite(value.getTime());
}

function resolveCalendarWeekEndDay(weekEndDay?: CalendarWeekEndDay): CalendarWeekEndDay {
	return weekEndDay ?? "sunday";
}

function resolveCalendarPeriodSelectionMode(selectionMode?: CalendarPeriodSelectionMode): CalendarPeriodSelectionMode {
	return selectionMode ?? "day";
}

/**
 * Возвращает включительные границы календарного периода без timezone-сдвига.
 */
export function getCalendarPeriod(value: Date | null | undefined, options: CalendarPeriodOptions = {}): CalendarPeriod | null {
	if (!isValidCalendarDate(value)) return null;

	const selectionMode = resolveCalendarPeriodSelectionMode(options.selectionMode);

	switch (selectionMode) {
		case "day": {
			return {
				start: getStartOfDay(value),
				end: getEndOfDay(value)
			};
		}

		case "week": {
			const start = getStartOfWeek(value);
			const weekEndOffset = WEEK_END_DAY_OFFSETS[resolveCalendarWeekEndDay(options.weekEndDay)];

			return {
				start,
				end: getEndOfDay(addCalendarDays(start, weekEndOffset))
			};
		}

		case "month": {
			return {
				start: getStartOfMonth(value),
				end: getEndOfDay(createCalendarDate(value.getFullYear(), value.getMonth() + 1, 0))
			};
		}

		case "year": {
			return {
				start: getStartOfYear(value),
				end: getEndOfDay(createCalendarDate(value.getFullYear(), 11, 31))
			};
		}

		default: {
			const checker: never = selectionMode;
			void checker;

			return null;
		}
	}
}

/**
 * Проверяет, входит ли дата в уже вычисленные включительные границы периода.
 */
export function isDateInsideCalendarPeriod(value: Date | null | undefined, period: CalendarPeriod | null | undefined): boolean {
	if (!isValidCalendarDate(value) || !period) return false;

	const dateTime = getStartOfDay(value).getTime();
	return dateTime >= period.start.getTime() && dateTime <= period.end.getTime();
}

/**
 * Проверяет, что весь период укладывается в заданные календарные границы выбора.
 */
export function isCalendarPeriodWithinDateBounds(
	period: CalendarPeriod | null | undefined,
	bounds: CalendarPeriodDateBounds = {}
): boolean {
	if (!period) return false;

	if (bounds.minDate && period.start.getTime() < getStartOfDay(bounds.minDate).getTime()) return false;
	if (bounds.maxDate && period.end.getTime() > getEndOfDay(bounds.maxDate).getTime()) return false;

	return true;
}
