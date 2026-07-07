import { describe, expect, it } from "vitest";

import {
	addCalendarDays,
	addCalendarMonths,
	addCalendarYears,
	createCalendarDate,
	getEndOfDay,
	getStartOfDay,
	getStartOfMonth,
	getStartOfWeek,
	getStartOfYear,
	isSameCalendarDay
} from "./calendarDate";

function snapshot(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

describe("calendarDate", () => {
	it("создаёт календарную дату и нормализует начало/конец дня", () => {
		const date = createCalendarDate(2026, 6, 2, 18, 30, 15, 999);

		expect(snapshot(date)).toBe("2026-7-2 18:30:15");
		expect(snapshot(getStartOfDay(date))).toBe("2026-7-2 0:0:0");
		expect(snapshot(getEndOfDay(date))).toBe("2026-7-2 23:59:59");
		expect(getEndOfDay(date).getMilliseconds()).toBe(0);
	});

	it("сдвигает дату в календарной семантике", () => {
		const date = new Date(2026, 6, 2, 18, 30);

		expect(snapshot(getStartOfMonth(date))).toBe("2026-7-1 0:0:0");
		expect(snapshot(addCalendarDays(date, -2))).toBe("2026-6-30 0:0:0");
		expect(snapshot(addCalendarMonths(date, 2))).toBe("2026-9-2 0:0:0");
		expect(snapshot(addCalendarYears(date, -1))).toBe("2025-7-2 0:0:0");
	});

	it("возвращает начало года без timezone-семантики", () => {
		expect(snapshot(getStartOfYear(new Date(2026, 6, 2, 18, 30)))).toBe("2026-1-1 0:0:0");
	});

	it("возвращает начало недели в локальной календарной семантике", () => {
		expect(snapshot(getStartOfWeek(new Date(2026, 6, 2, 18, 30)))).toBe("2026-6-29 0:0:0");
		expect(snapshot(getStartOfWeek(new Date(2026, 6, 5, 12, 0)))).toBe("2026-6-29 0:0:0");
		expect(snapshot(getStartOfWeek(new Date(2026, 6, 5, 12, 0), 0))).toBe("2026-7-5 0:0:0");
		expect(snapshot(getStartOfWeek(new Date(2026, 6, 5, 12, 0), Number.NaN))).toBe("2026-6-29 0:0:0");
		expect(snapshot(getStartOfWeek(new Date(2026, 6, 5, 12, 0), -1))).toBe("2026-7-4 0:0:0");
	});

	it("сравнивает только календарный день", () => {
		expect(isSameCalendarDay(new Date(2026, 6, 2, 1), new Date(2026, 6, 2, 23))).toBe(true);
		expect(isSameCalendarDay(new Date(2026, 6, 2), new Date(2026, 6, 3))).toBe(false);
		expect(isSameCalendarDay(null, new Date(2026, 6, 2))).toBe(false);
	});
});
