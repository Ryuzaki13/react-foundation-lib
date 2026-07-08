import { describe, expect, it } from "vitest";

import { getCalendarPeriod, isCalendarPeriodWithinDateBounds, isDateInsideCalendarPeriod } from "./calendarPeriod";

function snapshot(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

describe("calendarPeriod", () => {
	it("возвращает границы календарного дня по умолчанию", () => {
		const period = getCalendarPeriod(new Date(2026, 6, 2, 18, 30));

		expect(period && snapshot(period.start)).toBe("2026-7-2 0:0:0");
		expect(period && snapshot(period.end)).toBe("2026-7-2 23:59:59");
	});

	it("возвращает включительные границы недели с понедельника по выбранный последний день", () => {
		expect(snapshot(getCalendarPeriod(new Date(2026, 6, 2), { selectionMode: "week" })?.start ?? new Date(NaN))).toBe(
			"2026-6-29 0:0:0"
		);
		expect(snapshot(getCalendarPeriod(new Date(2026, 6, 2), { selectionMode: "week" })?.end ?? new Date(NaN))).toBe(
			"2026-7-5 23:59:59"
		);
		expect(
			snapshot(getCalendarPeriod(new Date(2026, 6, 2), { selectionMode: "week", weekEndDay: "saturday" })?.end ?? new Date(NaN))
		).toBe("2026-7-4 23:59:59");
		expect(
			snapshot(getCalendarPeriod(new Date(2026, 6, 2), { selectionMode: "week", weekEndDay: "friday" })?.end ?? new Date(NaN))
		).toBe("2026-7-3 23:59:59");
	});

	it("возвращает включительные границы месяца и года", () => {
		const month = getCalendarPeriod(new Date(2026, 1, 12), { selectionMode: "month" });
		const year = getCalendarPeriod(new Date(2026, 6, 12), { selectionMode: "year" });

		expect(month && snapshot(month.start)).toBe("2026-2-1 0:0:0");
		expect(month && snapshot(month.end)).toBe("2026-2-28 23:59:59");
		expect(year && snapshot(year.start)).toBe("2026-1-1 0:0:0");
		expect(year && snapshot(year.end)).toBe("2026-12-31 23:59:59");
	});

	it("проверяет попадание даты внутрь периода", () => {
		const period = getCalendarPeriod(new Date(2026, 6, 2), { selectionMode: "week", weekEndDay: "friday" });

		expect(isDateInsideCalendarPeriod(new Date(2026, 5, 29), period)).toBe(true);
		expect(isDateInsideCalendarPeriod(new Date(2026, 6, 3, 23), period)).toBe(true);
		expect(isDateInsideCalendarPeriod(new Date(2026, 6, 4), period)).toBe(false);
	});

	it("требует попадания всего периода в min/max границы", () => {
		const period = getCalendarPeriod(new Date(2026, 6, 2), { selectionMode: "week" });

		expect(isCalendarPeriodWithinDateBounds(period, { minDate: new Date(2026, 5, 29), maxDate: new Date(2026, 6, 5) })).toBe(true);
		expect(isCalendarPeriodWithinDateBounds(period, { minDate: new Date(2026, 5, 30) })).toBe(false);
		expect(isCalendarPeriodWithinDateBounds(period, { maxDate: new Date(2026, 6, 4) })).toBe(false);
	});
});
