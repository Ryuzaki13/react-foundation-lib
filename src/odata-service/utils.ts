import { BaseType, InputType, RangeType } from "../types";
import { isObject } from "../validators";

export function normalizeRangeValue(value: InputType): RangeType {
	if (Array.isArray(value)) {
		return [value[0] ?? null, value[1] ?? null];
	}

	return [isBaseValue(value) ? (value ?? null) : null, null];
}

export function normalizeBaseValue(value: InputType): BaseType {
	if (value instanceof Date) {
		return value;
	}

	if (Array.isArray(value) || isObject(value)) {
		return null;
	}

	return value;
}

export function isBaseValue(value: unknown): value is BaseType {
	return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date;
}
