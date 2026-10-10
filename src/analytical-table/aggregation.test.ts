import { describe, expect, it } from "vitest";

import { aggregateAnalyticalValues } from "./index";

describe("агрегации значений", () => {
	it.each([
		["sum", 12],
		["avg", 4],
		["min", 0],
		["max", 10]
	] as const)("%s пропускает отсутствующие и нечисловые значения", (aggregation, result) => {
		expect(aggregateAnalyticalValues([0, 2, 10, null, undefined, "", "8", false, Infinity, NaN], aggregation)).toBe(result);
	});
	it("count считает непустые значения, нули и false не пропускает", () => {
		expect(aggregateAnalyticalValues([0, false, "x", null, undefined, ""], "count")).toBe(3);
		expect(aggregateAnalyticalValues([], "count")).toBe(0);
		expect(aggregateAnalyticalValues([], "sum")).toBeNull();
	});
});
