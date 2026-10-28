import {
	addCalendarDays,
	createCalendarDate,
	getEndOfDay,
	getStartOfDay,
	getStartOfMonth,
	getStartOfWeek,
	getStartOfYear
} from "./calendarDate";

const CALENDAR_YEAR_END_MONTH_INDEX = 11;
const CALENDAR_YEAR_END_DAY = 31;

/** Значения выбора периода отделены от точности его текстового представления. */
const CALENDAR_PERIOD_MODE_DAY = "day";
const CALENDAR_PERIOD_MODE_WEEK = "week";
const CALENDAR_PERIOD_MODE_MONTH = "month";
const CALENDAR_PERIOD_MODE_YEAR = "year";
const CALENDAR_WEEK_END_FRIDAY = "friday";
const CALENDAR_WEEK_END_SATURDAY = "saturday";
const CALENDAR_WEEK_END_SUNDAY = "sunday";

export type CalendarPeriodSelectionMode =
	| typeof CALENDAR_PERIOD_MODE_DAY
	| typeof CALENDAR_PERIOD_MODE_WEEK
	| typeof CALENDAR_PERIOD_MODE_MONTH
	| typeof CALENDAR_PERIOD_MODE_YEAR;
export type CalendarWeekEndDay = typeof CALENDAR_WEEK_END_FRIDAY | typeof CALENDAR_WEEK_END_SATURDAY | typeof CALENDAR_WEEK_END_SUNDAY;

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
	[CALENDAR_WEEK_END_FRIDAY]: 4,
	[CALENDAR_WEEK_END_SATURDAY]: 5,
	[CALENDAR_WEEK_END_SUNDAY]: 6
};

function isValidCalendarDate(value: Date | null | undefined): value is Date {
	return value instanceof Date && Number.isFinite(value.getTime());
}

function resolveCalendarWeekEndDay(weekEndDay?: CalendarWeekEndDay): CalendarWeekEndDay {
	return weekEndDay ?? CALENDAR_WEEK_END_SUNDAY;
}

function resolveCalendarPeriodSelectionMode(selectionMode?: CalendarPeriodSelectionMode): CalendarPeriodSelectionMode {
	return selectionMode ?? CALENDAR_PERIOD_MODE_DAY;
}

/**
 * Возвращает включительные границы календарного периода без timezone-сдвига.
 */
export function getCalendarPeriod(value: Date | null | undefined, options: CalendarPeriodOptions = {}): CalendarPeriod | null {
	if (!isValidCalendarDate(value)) return null;

	const selectionMode = resolveCalendarPeriodSelectionMode(options.selectionMode);

	switch (selectionMode) {
		case CALENDAR_PERIOD_MODE_DAY: {
			return {
				start: getStartOfDay(value),
				end: getEndOfDay(value)
			};
		}

		case CALENDAR_PERIOD_MODE_WEEK: {
			const start = getStartOfWeek(value);
			const weekEndOffset = WEEK_END_DAY_OFFSETS[resolveCalendarWeekEndDay(options.weekEndDay)];

			return {
				start,
				end: getEndOfDay(addCalendarDays(start, weekEndOffset))
			};
		}

		case CALENDAR_PERIOD_MODE_MONTH: {
			return {
				start: getStartOfMonth(value),
				end: getEndOfDay(createCalendarDate(value.getFullYear(), value.getMonth() + 1, 0))
			};
		}

		case CALENDAR_PERIOD_MODE_YEAR: {
			return {
				start: getStartOfYear(value),
				end: getEndOfDay(createCalendarDate(value.getFullYear(), CALENDAR_YEAR_END_MONTH_INDEX, CALENDAR_YEAR_END_DAY))
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
