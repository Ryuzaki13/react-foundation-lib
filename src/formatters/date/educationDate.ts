import { addCalendarDays, createCalendarDate, getStartOfDay } from "./calendarDate";

const EDUCATION_DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EDUCATION_TIME_KEY_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const EDUCATION_YEAR_START_MONTH_INDEX = 8;
const EDUCATION_YEAR_START_DAY = 1;
const EDUCATION_YEAR_END_MONTH_INDEX = 7;
const EDUCATION_YEAR_END_DAY = 31;
const EDUCATION_WEEK_DAY_COUNT = 6;

/**
 * Машинный ключ календарного дня в образовательной системе.
 *
 * Формат всегда `YYYY-MM-DD`: он безопасен для URL, SQL-параметров и query keys,
 * но не несёт timezone-семантики.
 */
export type EducationDateKey = string;

/**
 * Диапазон учебного года. Учебный год начинается 1 сентября и заканчивается 31 августа.
 */
export type EducationYearRange = {
	readonly year: number;
	readonly start: Date;
	readonly end: Date;
};

/**
 * Диапазон учебной недели. В публичном расписании неделя отображается с понедельника по субботу.
 */
export type EducationWeekRange = {
	readonly start: Date;
	readonly end: Date;
};

function isValidTimePart(value: number, max: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= max;
}

/**
 * Разбирает `YYYY-MM-DD` без `Date.parse`, чтобы не получить скрытый timezone-сдвиг.
 */
export function parseEducationDateKey(value: string | undefined): Date | null {
	const match = value?.match(EDUCATION_DATE_KEY_RE);
	if (!match) {
		return null;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = createCalendarDate(year, month - 1, day);

	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * Форматирует `Date` в стабильный ключ `YYYY-MM-DD` по локальным календарным компонентам.
 */
export function formatEducationDateKey(value: Date): EducationDateKey {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, "0");
	const day = String(value.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

/**
 * Форматирует время в `HH:mm` по локальным компонентам, без UTC-преобразования.
 */
export function formatEducationTimeKey(value: Date): string {
	const hours = String(value.getHours()).padStart(2, "0");
	const minutes = String(value.getMinutes()).padStart(2, "0");

	return `${hours}:${minutes}`;
}

/**
 * Создаёт календарную дату-время из отдельных ключей даты и времени, удобных для SQL-выдачи.
 */
export function createEducationDateTime(dateKey: EducationDateKey, timeKey: string): Date | null {
	const date = parseEducationDateKey(dateKey);
	const match = timeKey.match(EDUCATION_TIME_KEY_RE);
	if (!date || !match) {
		return null;
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const seconds = Number(match[3] ?? 0);
	if (!isValidTimePart(hours, 23) || !isValidTimePart(minutes, 59) || !isValidTimePart(seconds, 59)) {
		return null;
	}

	return createCalendarDate(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds);
}

/**
 * Возвращает учебный год для календарной даты.
 */
export function getEducationYear(value: Date = new Date()): number {
	return value.getMonth() < EDUCATION_YEAR_START_MONTH_INDEX ? value.getFullYear() - 1 : value.getFullYear();
}

/**
 * Возвращает границы учебного года для переданной даты.
 */
export function getEducationYearRange(value: Date = new Date()): EducationYearRange {
	const year = getEducationYear(value);

	return {
		year,
		start: createCalendarDate(year, EDUCATION_YEAR_START_MONTH_INDEX, EDUCATION_YEAR_START_DAY),
		end: createCalendarDate(year + 1, EDUCATION_YEAR_END_MONTH_INDEX, EDUCATION_YEAR_END_DAY)
	};
}

/**
 * Проверяет, входит ли дата в учебный год, вычисленный от `now`.
 */
export function isEducationDateInCurrentYear(value: Date, now: Date = new Date()): boolean {
	const date = getStartOfDay(value);
	const { start, end } = getEducationYearRange(now);

	return date >= start && date <= end;
}

/**
 * Возвращает понедельник учебной недели. Воскресенье относится к следующей учебной неделе.
 */
export function getEducationWeekStartDate(value: Date): Date {
	const date = getStartOfDay(value);
	const dayOfWeek = (date.getDay() + 6) % 7;
	const daysToMonday = dayOfWeek === 6 ? 1 : -dayOfWeek;

	return addCalendarDays(date, daysToMonday);
}

/**
 * Возвращает диапазон учебной недели: понедельник-суббота.
 */
export function getEducationWeekRange(value: Date): EducationWeekRange {
	const start = getEducationWeekStartDate(value);

	return {
		start,
		end: addCalendarDays(start, EDUCATION_WEEK_DAY_COUNT - 1)
	};
}

/**
 * Возвращает ключи дней учебной недели для SSR, prefetch и клиентского отображения.
 */
export function getEducationWeekDays(week: EducationDateKey | Date): readonly EducationDateKey[] {
	const start =
		typeof week === "string" ? (parseEducationDateKey(week) ?? getEducationWeekStartDate(new Date())) : getEducationWeekStartDate(week);

	return Array.from({ length: EDUCATION_WEEK_DAY_COUNT }, (_, index) => formatEducationDateKey(addCalendarDays(start, index)));
}

/**
 * Возвращает ключ текущей учебной недели.
 */
export function getCurrentEducationWeekKey(now: Date = new Date()): EducationDateKey {
	return formatEducationDateKey(getEducationWeekStartDate(now));
}

/**
 * Нормализует произвольный ключ недели к понедельнику текущего учебного года.
 */
export function normalizeEducationWeekKey(value: string | undefined, now: Date = new Date()): EducationDateKey | undefined {
	const parsed = parseEducationDateKey(value);
	if (!parsed || !isEducationDateInCurrentYear(parsed, now)) {
		return undefined;
	}

	const weekStart = getEducationWeekStartDate(parsed);

	return isEducationDateInCurrentYear(weekStart, now) ? formatEducationDateKey(weekStart) : undefined;
}

/**
 * Возвращает валидный ключ недели или текущую учебную неделю как fallback.
 */
export function resolveEducationWeekKey(value: string | undefined, now: Date = new Date()): EducationDateKey {
	return normalizeEducationWeekKey(value, now) ?? getCurrentEducationWeekKey(now);
}

/**
 * Проверяет, совпадает ли неделя с текущей учебной неделей.
 */
export function isCurrentEducationWeek(week: EducationDateKey, now: Date = new Date()): boolean {
	return resolveEducationWeekKey(week, now) === getCurrentEducationWeekKey(now);
}
