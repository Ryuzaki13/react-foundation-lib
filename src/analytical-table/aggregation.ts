import { type AnalyticalAggregation } from "./types";

/** null/пустые/нечисловые значения не превращаются в ноль; count считает непустые факты. */
export function aggregateAnalyticalValues(values: readonly unknown[], aggregation: AnalyticalAggregation): number | null {
	const present = values.filter((value) => value !== null && value !== undefined && value !== "");
	if (aggregation === "count") return present.length;
	let count = 0;
	let sum = 0;
	let minimum = Infinity;
	let maximum = -Infinity;
	for (const value of present) {
		if (typeof value !== "number" || !Number.isFinite(value)) continue;
		count += 1;
		sum += value;
		minimum = Math.min(minimum, value);
		maximum = Math.max(maximum, value);
	}
	if (count === 0) return null;
	switch (aggregation) {
		case "sum":
			return sum;
		case "min":
			return minimum;
		case "max":
			return maximum;
		case "avg":
			return sum / count;
	}
}
