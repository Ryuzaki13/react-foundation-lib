import { describe, expect, it } from "vitest";

import {
	resolveMonthAgoRange,
	resolveMonthStartToTodayRange,
	resolveMonthStartToYesterdayRange,
	resolveTodayRange,
	resolveYesterdayRange
} from "./relativeRanges";

describe("relative date ranges", () => {
	it("строит диапазон с начала месяца по сегодня без timezone-сдвига", () => {
		const [startDate, endDate] = resolveMonthStartToTodayRange({
			referenceDate: new Date(2026, 2, 10, 12, 30, 0)
		});

		expect(startDate).toEqual(new Date(2026, 2, 1, 0, 0, 0));
		expect(endDate).toEqual(new Date(2026, 2, 10, 23, 59, 59));
	});

	it("строит диапазон за сегодня без timezone-сдвига", () => {
		const [startDate, endDate] = resolveTodayRange({
			referenceDate: new Date(2026, 2, 10, 12, 30, 0)
		});

		expect(startDate).toEqual(new Date(2026, 2, 10, 0, 0, 0));
		expect(endDate).toEqual(new Date(2026, 2, 10, 23, 59, 59));
	});

	it("строит диапазон за вчера без timezone-сдвига", () => {
		const [startDate, endDate] = resolveYesterdayRange({
			referenceDate: new Date(2026, 2, 10, 12, 30, 0)
		});

		expect(startDate).toEqual(new Date(2026, 2, 9, 0, 0, 0));
		expect(endDate).toEqual(new Date(2026, 2, 9, 23, 59, 59));
	});

	it("прижимает конец диапазона к старту месяца на первом дне месяца", () => {
		const [startDate, endDate] = resolveMonthStartToYesterdayRange({
			referenceDate: new Date(2026, 2, 1, 8, 0, 0)
		});

		expect(startDate).toEqual(new Date(2026, 2, 1, 0, 0, 0));
		expect(endDate).toEqual(new Date(2026, 2, 1, 23, 59, 59));
	});

	it("строит диапазон с начала текущей даты прошлого месяца по конец текущего дня", () => {
		const [startDate, endDate] = resolveMonthAgoRange({
			referenceDate: new Date(2026, 2, 1, 8, 0, 0)
		});

		expect(startDate).toEqual(new Date(2026, 1, 1, 0, 0, 0));
		expect(endDate).toEqual(new Date(2026, 2, 1, 23, 59, 59));
	});
});
