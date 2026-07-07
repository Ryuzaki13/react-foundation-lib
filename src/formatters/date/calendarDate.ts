/**
 * Создаёт календарную дату без timezone-семантики.
 *
 * Внутри используется локальный конструктор `Date`, чтобы видимые
 * компоненты даты и времени сохранялись без дополнительных смещений.
 */
export function createCalendarDate(year: number, monthIndex: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0): Date {
	return new Date(year, monthIndex, day, hour, minute, second, millisecond);
}

/**
 * Нормализует дату к началу суток без timezone-сдвига.
 */
export function getStartOfDay(date: Date): Date {
	return createCalendarDate(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Нормализует дату к концу суток без timezone-сдвига.
 */
export function getEndOfDay(date: Date): Date {
	return createCalendarDate(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0);
}

/**
 * Возвращает первый день месяца для переданной даты.
 */
export function getStartOfMonth(date: Date): Date {
	return createCalendarDate(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Возвращает первый день года для переданной даты.
 */
export function getStartOfYear(date: Date): Date {
	return createCalendarDate(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

/**
 * Возвращает начало календарной недели без timezone-сдвига.
 *
 * По умолчанию неделя начинается в понедельник, как в русскоязычной календарной
 * сетке. При необходимости вызывающий код может передать другой день недели
 * в формате `Date.getDay()`: 0 — воскресенье, 1 — понедельник.
 */
export function getStartOfWeek(date: Date, weekStartsOn = 1): Date {
	const normalizedWeekStart = Number.isInteger(weekStartsOn) ? ((weekStartsOn % 7) + 7) % 7 : 1;
	const start = getStartOfDay(date);
	const offset = (start.getDay() - normalizedWeekStart + 7) % 7;

	return addCalendarDays(start, -offset);
}

/**
 * Сдвигает дату на указанное количество суток в календарной семантике.
 */
export function addCalendarDays(date: Date, amount: number): Date {
	return createCalendarDate(date.getFullYear(), date.getMonth(), date.getDate() + amount, 0, 0, 0, 0);
}

/**
 * Сдвигает дату на указанное количество месяцев в календарной семантике.
 */
export function addCalendarMonths(date: Date, amount: number): Date {
	return createCalendarDate(date.getFullYear(), date.getMonth() + amount, date.getDate(), 0, 0, 0, 0);
}

/**
 * Сдвигает дату на указанное количество лет в календарной семантике.
 */
export function addCalendarYears(date: Date, amount: number): Date {
	return createCalendarDate(date.getFullYear() + amount, date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Проверяет, совпадают ли две даты по календарному дню.
 */
export function isSameCalendarDay(left: Date | null | undefined, right: Date | null | undefined): boolean {
	if (!(left instanceof Date) || !(right instanceof Date)) return false;

	return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
