import { describe, expect, it } from "vitest";

import {
	createEducationDateTime,
	formatEducationDateKey,
	formatEducationTimeKey,
	getEducationWeekDays,
	getEducationWeekRange,
	getEducationWeekStartDate,
	getEducationYearRange,
	normalizeEducationWeekKey,
	parseEducationDateKey
} from "./educationDate";

describe("educationDate", () => {
	it("разбирает и форматирует машинный ключ даты без timezone-семантики", () => {
		const date = parseEducationDateKey("2026-07-06");

		expect(date).toEqual(new Date(2026, 6, 6));
		expect(formatEducationDateKey(date!)).toBe("2026-07-06");
		expect(parseEducationDateKey("2026-02-31")).toBeNull();
	});

	it("строит учебный год с сентября по август", () => {
		expect(getEducationYearRange(new Date(2026, 6, 6))).toMatchObject({
			year: 2025,
			start: new Date(2025, 8, 1),
			end: new Date(2026, 7, 31)
		});
		expect(getEducationYearRange(new Date(2026, 8, 1)).year).toBe(2026);
	});

	it("считает воскресенье началом следующей учебной недели", () => {
		expect(formatEducationDateKey(getEducationWeekStartDate(new Date(2026, 6, 5)))).toBe("2026-07-06");
		expect(formatEducationDateKey(getEducationWeekRange(new Date(2026, 6, 5)).end)).toBe("2026-07-11");
	});

	it("возвращает шесть дней учебной недели", () => {
		expect(getEducationWeekDays("2026-07-06")).toEqual([
			"2026-07-06",
			"2026-07-07",
			"2026-07-08",
			"2026-07-09",
			"2026-07-10",
			"2026-07-11"
		]);
	});

	it("нормализует неделю только в пределах текущего учебного года", () => {
		const now = new Date(2026, 6, 6);

		expect(normalizeEducationWeekKey("2026-07-08", now)).toBe("2026-07-06");
		expect(normalizeEducationWeekKey("2026-09-02", now)).toBeUndefined();
	});

	it("создаёт локальное дату-время из ключей даты и времени", () => {
		const date = createEducationDateTime("2026-07-06", "08:30:00");

		expect(date).toEqual(new Date(2026, 6, 6, 8, 30, 0));
		expect(formatEducationTimeKey(date!)).toBe("08:30");
		expect(createEducationDateTime("2026-07-06", "24:00")).toBeNull();
	});
});
