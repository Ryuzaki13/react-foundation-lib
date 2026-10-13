import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createIndexedRecordsSchema } from "./schema";

import { getIndexedRecord, type IndexedRecords } from "./index";

type Item = Readonly<{ id: string; label: string }>;
const ItemSchema = z.strictObject({ id: z.string(), label: z.string() }).readonly() satisfies z.ZodType<Item>;
const itemsSchema = z.array(ItemSchema).readonly();
const schema = createIndexedRecordsSchema({ itemsSchema, getId: (item) => item.id });

function createWire() {
	return {
		items: [
			{ id: "B", label: "Второй" },
			{ id: "A", label: "Первый" }
		],
		indexById: { B: 0, A: 1 }
	};
}

describe("проверка доставленных индексированных записей", () => {
	it("переиспользует результат единственного owner parse, сохраняя порядок, записи и вложенный freeze", () => {
		type NestedItem = Readonly<{ id: string; details: Readonly<{ label: string }> }>;
		let parsedItems: readonly NestedItem[] | undefined;
		const capture = vi.fn((items: readonly NestedItem[]) => {
			parsedItems = items;
			return items;
		});
		const nestedSchema = createIndexedRecordsSchema({
			itemsSchema: z
				.array(z.strictObject({ id: z.string(), details: z.strictObject({ label: z.string() }).readonly() }).readonly())
				.readonly()
				.transform(capture),
			getId: (item) => item.id
		});
		const wire = {
			items: [
				{ id: "B", details: { label: "Второй" } },
				{ id: "A", details: { label: "Первый" } }
			],
			indexById: { B: 0, A: 1 }
		};
		const records = nestedSchema.parse(wire);
		expect(capture).toHaveBeenCalledOnce();
		expect(records.items).toBe(parsedItems);
		expect(records.items).not.toBe(wire.items);
		expect(records.items.map((item) => item.id)).toEqual(["B", "A"]);
		expect(getIndexedRecord(records, "A")).toBe(parsedItems?.[1]);
		for (const value of [records, records.indexById, records.items, records.items[0], records.items[0]?.details]) {
			expect(Object.isFrozen(value)).toBe(true);
		}
		expect(Object.isFrozen(wire.items)).toBe(false);
		expect(Object.isFrozen(wire.items[0]?.details)).toBe(false);
	});

	it("поддерживает JSON roundtrip opaque IDs без нормализации или потери __proto__", () => {
		const ids = ["__proto__", "constructor", "toString", "", "0", "01"];
		const indexById = Object.create(null) as Record<string, number>;
		ids.forEach((id, position) => {
			indexById[id] = position;
		});
		const wire: unknown = JSON.parse(JSON.stringify({ items: ids.map((id) => ({ id, label: id })), indexById }));
		const records = schema.parse(wire);
		expect(Object.getPrototypeOf(records.indexById)).toBeNull();
		ids.forEach((id, position) => {
			expect(Object.hasOwn(records.indexById, id)).toBe(true);
			expect(records.indexById[id]).toBe(position);
			expect(getIndexedRecord(records, id)).toBe(records.items[position]);
		});
	});

	it("сопоставляет числовую предметную identity только по заданному extractor", () => {
		const numericSchema = createIndexedRecordsSchema({
			itemsSchema: z.array(z.strictObject({ key: z.number().int() }).readonly()).readonly(),
			getId: (item) => String(item.key)
		});
		expect(numericSchema.parse({ items: [{ key: 4 }], indexById: { "4": 0 } }).indexById["4"]).toBe(0);
		expect(numericSchema.safeParse({ items: [{ key: 4 }], indexById: { "04": 0 } }).success).toBe(false);
	});

	it("читает готовые позиции без итерации owner массива и без повторной индексации", () => {
		const items = new Proxy(
			Object.freeze([
				{ id: "B", label: "Второй" },
				{ id: "A", label: "Первый" }
			]),
			{
				get: (target, property, receiver) => {
					if (property === Symbol.iterator || property === "map" || property === "find" || property === "filter") {
						throw new Error("Проверка доставленных позиций не должна обходить owner массив.");
					}
					return Reflect.get(target, property, receiver);
				}
			}
		);
		const parseOwner = vi.fn((value: unknown) => value === items);
		const getId = vi.fn((item: Item) => item.id);
		const addressedSchema = createIndexedRecordsSchema({ itemsSchema: z.custom<readonly Item[]>(parseOwner), getId });
		const records = addressedSchema.parse({ items, indexById: { A: 1, B: 0 } });
		expect(records.items).toBe(items);
		expect(parseOwner).toHaveBeenCalledOnce();
		expect(getId).toHaveBeenNthCalledWith(1, items[1]);
		expect(getId).toHaveBeenNthCalledWith(2, items[0]);
		expect(getId).toHaveBeenCalledTimes(2);
	});

	it("сохраняет предметные межстрочные ограничения owner schema", () => {
		const constrained = createIndexedRecordsSchema({
			itemsSchema: itemsSchema.superRefine((items, context) => {
				if (new Set(items.map((item) => item.label)).size !== items.length) {
					context.addIssue({ code: "custom", message: "Подписи должны различаться." });
				}
			}),
			getId: (item) => item.id
		});
		expect(
			constrained.safeParse({
				items: [
					{ id: "A", label: "Одинаковая" },
					{ id: "B", label: "Одинаковая" }
				],
				indexById: { A: 0, B: 1 }
			}).success
		).toBe(false);
	});

	it("замораживает только собственные оболочку и индекс, не подменяя owner freeze рекурсией", () => {
		const shallowOwner = createIndexedRecordsSchema({
			itemsSchema: z.array(z.strictObject({ id: z.string(), nested: z.strictObject({ value: z.number() }) })),
			getId: (item) => item.id
		});
		const wire = { items: [{ id: "A", nested: { value: 1 } }], indexById: { A: 0 } };
		const records = shallowOwner.parse(wire);
		expect(Object.isFrozen(records)).toBe(true);
		expect(Object.isFrozen(records.indexById)).toBe(true);
		expect(Object.isFrozen(records.items)).toBe(false);
		expect(Object.isFrozen(records.items[0])).toBe(false);
		expect(Object.isFrozen(records.items[0]?.nested)).toBe(false);
		expect(Object.isFrozen(wire)).toBe(false);
		expect(Object.isFrozen(wire.indexById)).toBe(false);
	});

	it("принимает пустой каталог без вызова extractor и допускает primitive undefined как owner значение", () => {
		const getId = vi.fn((item: Item) => item.id);
		const empty = createIndexedRecordsSchema({ itemsSchema, getId }).parse({ items: [], indexById: {} });
		expect(empty.items).toEqual([]);
		expect(getId).not.toHaveBeenCalled();
		const undefinedRecords: IndexedRecords<undefined> = createIndexedRecordsSchema({
			itemsSchema: z.array(z.undefined()).readonly(),
			getId: () => "undefined"
		}).parse({ items: [undefined], indexById: { undefined: 0 } });
		expect(Object.hasOwn(undefinedRecords.items, 0)).toBe(true);
		expect(undefinedRecords.indexById.undefined).toBe(0);
	});

	it.each([null, [], new Date(), new Map(), {}, { items: [] }, { indexById: {} }, { ...createWire(), revision: "1" }])(
		"отклоняет неверную или нестрогую оболочку %#",
		(wire) => {
			expect(schema.safeParse(wire).success).toBe(false);
		}
	);

	it.each([
		null,
		[],
		new Date(),
		new Map(),
		Object.create({ A: 1 }),
		{},
		{ B: 0 },
		{ B: 0, A: 1, extra: 2 },
		{ B: 1, A: 0 },
		{ B: -1, A: 1 },
		{ B: 0, A: 2 },
		{ B: 0, A: 0 },
		{ B: 0, A: 0.5 },
		{ B: 0, A: "1" },
		{ B: 0, A: NaN },
		{ B: 0, A: Infinity },
		{ B: 0, A: Number.MAX_SAFE_INTEGER + 1 }
	])("отклоняет повреждённый индекс %# вместо восстановления по items", (indexById) => {
		expect(schema.safeParse({ ...createWire(), indexById }).success).toBe(false);
	});

	it("отклоняет дубликаты identity и повреждённые записи, не разрешая индексом ослабить owner contract", () => {
		expect(
			schema.safeParse({
				items: [
					{ id: "A", label: "Первый" },
					{ id: "A", label: "Второй" }
				],
				indexById: { A: 0 }
			}).success
		).toBe(false);
		expect(schema.safeParse({ items: [{ id: "A", label: 1 }], indexById: { A: 0 } }).success).toBe(false);
	});

	it("отклоняет accessor/symbol/non-enumerable на оболочке до чтения itemsSchema", () => {
		const parseOwner = vi.fn((items: readonly Item[]) => items);
		const guarded = createIndexedRecordsSchema({ itemsSchema: itemsSchema.transform(parseOwner), getId: (item) => item.id });
		const accessor = { indexById: createWire().indexById };
		Object.defineProperty(accessor, "items", {
			enumerable: true,
			get: () => {
				throw new Error("Accessor оболочки прочитан.");
			}
		});
		const symbol = { ...createWire(), [Symbol("extra")]: 1 };
		const hidden = createWire();
		Object.defineProperty(hidden, "extra", { value: 1 });
		for (const wire of [accessor, symbol, hidden]) expect(guarded.safeParse(wire).success).toBe(false);
		expect(parseOwner).not.toHaveBeenCalled();
	});

	it("не читает и не принимает унаследованные items/indexById при изменённом Object.prototype", () => {
		const prototype = Object.prototype;
		const oldItems = Object.getOwnPropertyDescriptor(prototype, "items");
		const oldIndex = Object.getOwnPropertyDescriptor(prototype, "indexById");
		const getter = vi.fn(() => {
			throw new Error("Унаследованный accessor прочитан.");
		});
		try {
			Object.defineProperty(prototype, "items", { configurable: true, get: getter });
			Object.defineProperty(prototype, "indexById", { configurable: true, value: {} });
			expect(schema.safeParse({}).success).toBe(false);
			expect(schema.safeParse({ indexById: {} }).success).toBe(false);
			expect(schema.safeParse({ items: [] }).success).toBe(false);
			expect(getter).not.toHaveBeenCalled();
		} finally {
			if (oldItems) Object.defineProperty(prototype, "items", oldItems);
			else Reflect.deleteProperty(prototype, "items");
			if (oldIndex) Object.defineProperty(prototype, "indexById", oldIndex);
			else Reflect.deleteProperty(prototype, "indexById");
		}
	});

	it("отклоняет accessor/symbol/non-enumerable индекса без вызова getter", () => {
		const accessor = { B: 0 };
		Object.defineProperty(accessor, "A", {
			enumerable: true,
			get: () => {
				throw new Error("Accessor индекса прочитан.");
			}
		});
		const symbol = { ...createWire().indexById, [Symbol("extra")]: 1 };
		const hidden = { ...createWire().indexById };
		Object.defineProperty(hidden, "extra", { value: 1 });
		for (const indexById of [accessor, symbol, hidden]) expect(schema.safeParse({ ...createWire(), indexById }).success).toBe(false);
	});
});
