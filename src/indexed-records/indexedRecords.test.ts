import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { createIndexedRecords, getIndexedRecord, type IndexedRecords } from "./index";

describe("индексированные записи", () => {
	it("сохраняет массив, порядок и ссылки, вычисляя identity ровно один раз для каждой записи", () => {
		const items = [
			{ id: "B", code: "102" },
			{ id: "A", code: "101" }
		];
		const getId = vi.fn((item: (typeof items)[number]) => item.id);
		const records = createIndexedRecords(items, getId);

		expect(records.items).toBe(items);
		expect(records.indexById).toEqual({ B: 0, A: 1 });
		expect(getIndexedRecord(records, "B")).toBe(items[0]);
		expect(getIndexedRecord(records, "A")).toBe(items[1]);
		expect(getId).toHaveBeenCalledTimes(items.length);
		expect(items.map((item) => item.id)).toEqual(["B", "A"]);
	});

	it("не принимает унаследованные ключи за записи и не пропускает нулевую позицию", () => {
		const items = [{ id: "first" }];
		const records = createIndexedRecords(items, (item) => item.id);

		expect(getIndexedRecord(records, "first")).toBe(items[0]);
		expect(getIndexedRecord(records, "missing")).toBeUndefined();
		expect(getIndexedRecord(records, "constructor")).toBeUndefined();
		expect(getIndexedRecord(records, "toString")).toBeUndefined();
	});

	it("поддерживает prototype-подобные, пустые и числовые строковые identities без нормализации", () => {
		const ids = ["__proto__", "constructor", "toString", "hasOwnProperty", "", "0", "01"];
		const items = ids.map((id) => ({ id }));
		const records = createIndexedRecords(items, (item) => item.id);

		expect(Object.getPrototypeOf(records.indexById)).toBeNull();
		for (let index = 0; index < ids.length; index += 1) {
			expect(Object.hasOwn(records.indexById, ids[index])).toBe(true);
			expect(getIndexedRecord(records, ids[index])).toBe(items[index]);
		}
	});

	it.each(["A", "__proto__"])("отклоняет не соседние дубликаты identity %s без замены первой записи", (duplicateId) => {
		const items = [
			{ id: duplicateId, value: 1 },
			{ id: "different", value: 2 },
			{ id: duplicateId, value: 3 }
		];

		expect(() => createIndexedRecords(items, (item) => item.id)).toThrow("Повторный идентификатор в индексированных записях.");
		expect(items.map((item) => item.value)).toEqual([1, 2, 3]);
	});

	it("замораживает собственную metadata, сохраняя ownership исходных записей у caller", () => {
		const items = [{ id: "A", nested: { code: "101" } }];
		const records = createIndexedRecords(items, (item) => item.id);

		expect(Object.isFrozen(records)).toBe(true);
		expect(Object.isFrozen(records.indexById)).toBe(true);
		expect(Object.isFrozen(items)).toBe(false);
		expect(Object.isFrozen(items[0])).toBe(false);
		expect(Object.isFrozen(items[0].nested)).toBe(false);
		expectTypeOf(records).toEqualTypeOf<IndexedRecords<(typeof items)[number]>>();
		expectTypeOf(records.items).toEqualTypeOf<readonly (typeof items)[number][]>();
		expectTypeOf(records.indexById).toEqualTypeOf<Readonly<Record<string, number>>>();
	});

	it("сохраняет lookup после structured clone с обычным prototype и возвращает запись восстановленного массива", () => {
		const records = createIndexedRecords([{ id: "__proto__" }], (item) => item.id);
		const restored = structuredClone(records);

		expect(Object.getPrototypeOf(restored.indexById)).toBe(Object.prototype);
		expect(getIndexedRecord(restored, "__proto__")).toBe(restored.items[0]);
		expect(getIndexedRecord(restored, "constructor")).toBeUndefined();
	});

	it("поддерживает пустой снимок без вызова extractor", () => {
		const getId = vi.fn((item: Readonly<{ id: string }>) => item.id);
		const records = createIndexedRecords([], getId);

		expect(records.items).toEqual([]);
		expect(Object.keys(records.indexById)).toEqual([]);
		expect(getIndexedRecord(records, "any")).toBeUndefined();
		expect(getId).not.toHaveBeenCalled();
	});
});
