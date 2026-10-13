import { createIndexedRecords, getIndexedRecord, type IndexedRecords } from "../src/indexed-records";

/** Равенство типов проверяется tsc; runtime runner этот модуль не исполняет. */
type TypesEqual<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;

const items = [
	{ id: "first", code: "101", nested: { value: 1 } },
	{ id: "second", code: "102", nested: { value: 2 } }
] as const;
type Item = (typeof items)[number];

const records = createIndexedRecords(items, (item) => item.id);
const found = getIndexedRecord(records, "first");

// Явные присваивания фиксируют inference и modifiers публичного контракта.
const preservesRecordInference: TypesEqual<typeof records, IndexedRecords<Item>> = true;
const returnsOriginalRecordType: TypesEqual<typeof found, Item | undefined> = true;
const readonlyItems: TypesEqual<typeof records.items, readonly Item[]> = true;
const readonlyIndex: TypesEqual<typeof records.indexById, Readonly<Record<string, number>>> = true;
const readonlyContainer: TypesEqual<
	typeof records,
	Readonly<{ items: readonly Item[]; indexById: Readonly<Record<string, number>> }>
> = true;

// Эти проверки подтверждают, что используемое равенство замечает потерю readonly.
const distinguishesMutableItems: TypesEqual<readonly Item[], Item[]> = false;
const distinguishesMutableIndex: TypesEqual<Readonly<Record<string, number>>, Record<string, number>> = false;
const distinguishesMutableContainer: TypesEqual<
	IndexedRecords<Item>,
	{ items: readonly Item[]; indexById: Readonly<Record<string, number>> }
> = false;

const create: <RecordValue>(items: readonly RecordValue[], getId: (item: RecordValue) => string) => IndexedRecords<RecordValue> =
	createIndexedRecords;
const lookup: <RecordValue>(records: IndexedRecords<RecordValue>, id: string) => RecordValue | undefined = getIndexedRecord;

void [
	found,
	preservesRecordInference,
	returnsOriginalRecordType,
	readonlyItems,
	readonlyIndex,
	readonlyContainer,
	distinguishesMutableItems,
	distinguishesMutableIndex,
	distinguishesMutableContainer,
	create,
	lookup
];
