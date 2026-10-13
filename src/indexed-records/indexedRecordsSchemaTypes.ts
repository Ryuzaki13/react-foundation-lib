import { type z } from "zod";

/** Предметная схема владеет записями, их неизменностью и канонической identity. */
export type IndexedRecordsSchemaOptions<T> = Readonly<{
	itemsSchema: z.ZodType<readonly T[]>;
	getId: (item: T) => string;
}>;
