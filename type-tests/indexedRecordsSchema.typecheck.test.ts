import { z } from "zod";

import { type IndexedRecords } from "../src/indexed-records";
import { createIndexedRecordsSchema, type IndexedRecordsSchemaOptions } from "../src/indexed-records/schema";

/** Проверяет public generic inference настоящим tsc, без runtime type assertions. */
type TypesEqual<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Item = Readonly<{ uuid: string; details: Readonly<{ label: string }> }>;

const itemsSchema: z.ZodType<readonly Item[]> = z
	.array(z.strictObject({ uuid: z.string(), details: z.strictObject({ label: z.string() }).readonly() }).readonly())
	.readonly();
const options = { itemsSchema, getId: (item: Item) => item.uuid } satisfies IndexedRecordsSchemaOptions<Item>;
const schema = createIndexedRecordsSchema(options);
const records = schema.parse({ items: [], indexById: {} });

const exactSchemaType: TypesEqual<typeof schema, z.ZodType<IndexedRecords<Item>>> = true;
const preservesRecordInference: TypesEqual<typeof records, IndexedRecords<Item>> = true;
const readonlyItems: TypesEqual<typeof records.items, readonly Item[]> = true;
const readonlyIndex: TypesEqual<typeof records.indexById, Readonly<Record<string, number>>> = true;
const preservesNestedReadonly: TypesEqual<(typeof records.items)[number]["details"], Readonly<{ label: string }>> = true;
const distinguishesMutableItems: TypesEqual<typeof records.items, Item[]> = false;
const extractor: (item: Item) => string = options.getId;
const factory: <Value>(options: IndexedRecordsSchemaOptions<Value>) => z.ZodType<IndexedRecords<Value>> = createIndexedRecordsSchema;

// Primitive и nullable предметные значения не требуют выдуманного поля id.
const nullableSchema = createIndexedRecordsSchema({
	itemsSchema: z.array(z.string().nullable()).readonly(),
	getId: (value) => (value === null ? "null" : value)
});
const supportsPrimitiveItems: TypesEqual<ReturnType<typeof nullableSchema.parse>, IndexedRecords<string | null>> = true;

const inferredObjectSchema = createIndexedRecordsSchema({
	itemsSchema: z
		.array(z.strictObject({ identity: z.string(), details: z.strictObject({ label: z.string() }).readonly() }).readonly())
		.readonly(),
	getId: (item) => item.identity
});
type InferredObject = Readonly<{ identity: string; details: Readonly<{ label: string }> }>;
const infersObjectWithoutAnnotation: TypesEqual<ReturnType<typeof inferredObjectSchema.parse>, IndexedRecords<InferredObject>> = true;

void [
	records,
	nullableSchema,
	inferredObjectSchema,
	exactSchemaType,
	preservesRecordInference,
	readonlyItems,
	readonlyIndex,
	preservesNestedReadonly,
	distinguishesMutableItems,
	extractor,
	factory,
	supportsPrimitiveItems,
	infersObjectWithoutAnnotation
];
