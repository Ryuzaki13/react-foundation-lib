import {
	ANALYTICAL_AGGREGATION_SUM,
	ANALYTICAL_AGGREGATION_MIN,
	ANALYTICAL_AGGREGATION_MAX,
	ANALYTICAL_AGGREGATION_AVG,
	ANALYTICAL_AGGREGATION_COUNT
} from "../definition/analyticalDefinitionConstants";
import { type AnalyticalAggregation } from "../types";

/** null/пустые/нечисловые значения не превращаются в ноль; count считает непустые факты. */
export function aggregateAnalyticalValues(values: readonly unknown[], aggregation: AnalyticalAggregation): number | null {
	const present = values.filter((value) => value !== null && value !== undefined && value !== "");
	if (aggregation === ANALYTICAL_AGGREGATION_COUNT) return present.length;

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
		case ANALYTICAL_AGGREGATION_SUM:
			return sum;
		case ANALYTICAL_AGGREGATION_MIN:
			return minimum;
		case ANALYTICAL_AGGREGATION_MAX:
			return maximum;
		case ANALYTICAL_AGGREGATION_AVG:
			return sum / count;
	}
}
