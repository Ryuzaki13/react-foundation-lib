import { z } from "zod";

import type { ODataMetaType } from "./types";

export const odataTypeSchemas: Record<ODataMetaType, z.ZodTypeAny> = {
	string: z.string(),
	guid: z.uuid().or(z.string().regex(/^[0-9a-fA-F-]+$/, "Invalid GUID")),
	boolean: z.boolean(),
	int: z.number().int(),
	long: z.number().int(),
	float: z.number(),
	decimal: z.number(),
	double: z.number(),
	datetime: z.date(),
	datetimeOffset: z.date(),
	time: z.date(),
	binary: z.string(),
	byte: z.number().int().min(0).max(255)
};

// Type Guards на основе Zod
function isType<T>(value: unknown, schema: z.ZodType<T>): value is T {
	return schema.safeParse(value).success;
}

// Специфичные Type Guards
export function isStringSafe(value: unknown): value is string {
	return isType(value, odataTypeSchemas.string);
}

export function isNumberSafe(value: unknown): value is number {
	return isType(value, odataTypeSchemas.float); // используем float как базовый числовой тип
}

export function isBooleanSafe(value: unknown): value is boolean {
	return isType(value, odataTypeSchemas.boolean);
}

export function isDateSafe(value: unknown): value is Date {
	return isType(value, odataTypeSchemas.datetime);
}
