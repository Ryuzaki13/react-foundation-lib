import { describe, expect, it } from "vitest";

import {
	clampNumberScaleValue,
	findClosestNumberScaleMark,
	findClosestNumberScaleMarkByPercent,
	getNumberScaleMarkPercent,
	normalizeNumberScaleStep,
	offsetNumberScaleValue,
	percentToNumberScaleValue,
	percentToSnappedNumberScaleValue,
	prepareNumberScaleMarks,
	resolveNumberScaleBounds,
	snapNumberScaleValue,
	snapNumberScaleValueToMarks,
	snapNumberScaleValueToStep,
	valueToNumberScalePercent
} from "./numberScale";

describe("numberScale", () => {
	it("нормализует границы и шаг шкалы", () => {
		expect(resolveNumberScaleBounds(100, 0)).toEqual({ min: 0, max: 100 });
		expect(resolveNumberScaleBounds(Number.NaN, 0)).toEqual({ min: 0, max: 100 });
		expect(normalizeNumberScaleStep(0)).toBe(1);
		expect(normalizeNumberScaleStep(-1)).toBe(1);
		expect(normalizeNumberScaleStep(0.5)).toBe(0.5);
	});

	it("clamp и snap по step работают предсказуемо", () => {
		expect(clampNumberScaleValue(120, 0, 100)).toBe(100);
		expect(clampNumberScaleValue(Number.NaN, 10, 100)).toBe(10);
		expect(snapNumberScaleValueToStep(16, 0, 100, 5)).toBe(15);
		expect(snapNumberScaleValueToStep(16.24, 0, 100, 0.25)).toBe(16.25);
	});

	it("marks фильтруются, сортируются и дедуплицируются", () => {
		const marks = prepareNumberScaleMarks(
			[
				{ value: 75, label: "75" },
				{ value: 25, label: "25" },
				{ value: 25, label: "dup" },
				{ value: 200, label: "200" }
			],
			0,
			100
		);

		expect(marks.map((mark) => mark.value)).toEqual([25, 75]);
	});

	it("snap по marks использует ближайшие допустимые значения", () => {
		const marks = [{ value: 0 }, { value: 30 }, { value: 80 }] as const;

		expect(snapNumberScaleValueToMarks(34, marks, 0, 100)).toBe(30);
		expect(findClosestNumberScaleMark(75, marks)?.value).toBe(80);
		expect(findClosestNumberScaleMark(75, [])).toBeUndefined();
		expect(snapNumberScaleValue(34, { min: 0, max: 100, step: 10, marks })).toBe(30);
	});

	it("поддерживает пропорциональное и равномерное позиционирование marks", () => {
		const marks = [{ value: 1 }, { value: 3 }, { value: 6 }, { value: 12 }, { value: 24 }] as const;

		expect(valueToNumberScalePercent(6, 1, 24)).toBeCloseTo(21.739);
		expect(percentToNumberScaleValue(50, 0, 10)).toBe(5);
		expect(valueToNumberScalePercent(6, 10, 10)).toBe(0);
		expect(percentToNumberScaleValue(50, 10, 10)).toBe(10);
		expect(getNumberScaleMarkPercent(2, marks, 1, 24, "index")).toBe(50);
		expect(getNumberScaleMarkPercent(0, [{ value: 1 }], 1, 24, "index")).toBe(0);
		expect(findClosestNumberScaleMarkByPercent(49, marks, 1, 24, "index")?.value).toBe(6);
		expect(findClosestNumberScaleMarkByPercent(49, [], 1, 24, "index")).toBeUndefined();
		expect(percentToSnappedNumberScaleValue(77, { min: 1, max: 24, marks, marksPosition: "index" })).toBe(12);
	});

	it("смещает значение по marks или step с учетом границ", () => {
		const marks = [{ value: 0 }, { value: 30 }, { value: 80 }] as const;

		expect(offsetNumberScaleValue(34, 1, { min: 0, max: 100, marks })).toBe(80);
		expect(offsetNumberScaleValue(34, -1, { min: 0, max: 100, marks })).toBe(0);
		expect(offsetNumberScaleValue(34, 2, { min: 0, max: 100, step: 10 })).toBe(50);
		expect(offsetNumberScaleValue(95, 2, { min: 0, max: 100, step: 10 })).toBe(100);
	});
});
