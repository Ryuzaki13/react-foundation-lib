import { describe, expect, it } from "vitest";

import { readRangeOutputValueFallback, resolveRangeOutputValue } from "./rangeOutput";

describe("rangeOutput", () => {
	it("подставляет значения только для открытых границ", () => {
		expect(resolveRangeOutputValue([null, 6], { start: 0, end: 12 })).toEqual([0, 6]);
		expect(resolveRangeOutputValue([3, null], { start: 0, end: 12 })).toEqual([3, 12]);
	});

	it("сохраняет null, если для открытой границы нет подстановки", () => {
		expect(resolveRangeOutputValue([null, null], { end: 12 })).toEqual([null, 12]);
		expect(resolveRangeOutputValue([null, null], undefined)).toEqual([null, null]);
	});

	it("читает сериализуемые границы через переданный парсер", () => {
		const fallback = readRangeOutputValueFallback({ outputValueFallback: { start: "1", end: "bad" } }, (value) => {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : undefined;
		});

		expect(fallback).toEqual({ start: 1 });
	});

	it("игнорирует невалидные данные подстановки", () => {
		expect(readRangeOutputValueFallback({ outputValueFallback: [] }, () => 1)).toBeUndefined();
		expect(readRangeOutputValueFallback(undefined, () => 1)).toBeUndefined();
	});
});
