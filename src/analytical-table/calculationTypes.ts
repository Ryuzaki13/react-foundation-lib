import { type AnalyticalValues } from "./dataTypes";

export type AnalyticalCalculationStep = Readonly<{
	columnId: string;
	dependencies: readonly string[];
	compute: (values: AnalyticalValues) => unknown;
}>;

export type AnalyticalCalculationPlan = Readonly<{
	steps: readonly AnalyticalCalculationStep[];
	requiredColumnIds: readonly string[];
}>;
