import { parseDate } from "../formatters";
import { compareStrings } from "../string-comparison";
import { stableStringify } from "../utils";

import { type AnalyticalColumn, type AnalyticalValues } from "./types";

/** Тип входит в ключ: null, undefined, строка и число не склеивают разные группы. */
export function analyticalIdentity(values: AnalyticalValues, ids: readonly string[]): string {
	return stableStringify(
		ids.map((id) => {
			const value = values[id];
			return [id, value === null ? "null" : typeof value, value];
		})
	);
}

export function compareAnalyticalValues<T>(left: unknown, right: unknown, column?: AnalyticalColumn<T>): number {
	if (Object.is(left, right)) return 0;
	if (left === null || left === undefined) return 1;
	if (right === null || right === undefined) return -1;
	if (column?.compare) return column.compare(left, right);
	if (column?.valueType === "date") {
		const leftDate = parseDate(left);
		const rightDate = parseDate(right);
		if (leftDate && rightDate) return leftDate.getTime() - rightDate.getTime();
	}
	if (typeof left === "number" && typeof right === "number") return left - right;
	if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
	return compareStrings(String(left), String(right));
}
