import { divideWhenAgFormatter, divideWhenFieldOrNullFormatter, valueWhenFieldOrNullFormatter } from "./hierarchyDependency";

import type { RowBasedFormatterDefinition } from "../types";

/**
 * Базовые формулы подмены значения для групповых строк.
 */
export const rowBasedFormatterDefinitions: readonly RowBasedFormatterDefinition[] = Object.freeze([
	divideWhenAgFormatter,
	valueWhenFieldOrNullFormatter,
	divideWhenFieldOrNullFormatter
]);
