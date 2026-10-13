import { z } from "zod";

import { isPlainObject, isRecord } from "../validators/isRecord";

import { type IndexedRecordsSchemaOptions } from "./indexedRecordsSchemaTypes";
import { type IndexedRecords } from "./indexedRecordsTypes";

/** Не позволяет Zod прочитать accessor или проигнорировать symbol на wire-оболочке. */
function hasIndexedRecordsWireDataProperties(value: unknown): value is Record<string, unknown> {
	if (!isRecord(value) || !isPlainObject(value)) return false;
	if (!Object.hasOwn(value, "items") || !Object.hasOwn(value, "indexById")) return false;
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) return false;
	}
	return true;
}

/**
 * Проверяет доставленный позиционный индекс, не восстанавливая его по items.
 * Предметная itemsSchema вызывается один раз и сохраняет свой порядок/ссылки;
 * она же обеспечивает неизменность массива, записей и вложенных значений.
 * Фабрика создаёт и замораживает только собственные оболочку и numeric index.
 */
export function createIndexedRecordsSchema<T>({ itemsSchema, getId }: IndexedRecordsSchemaOptions<T>): z.ZodType<IndexedRecords<T>> {
	return z
		.custom<Record<string, unknown>>(
			hasIndexedRecordsWireDataProperties,
			"Ожидалась структура индексированных записей без accessor и symbol."
		)
		.pipe(z.strictObject({ items: itemsSchema, indexById: z.unknown() }))
		.transform((wire, context): IndexedRecords<T> => {
			if (!isRecord(wire.indexById) || !isPlainObject(wire.indexById)) {
				context.addIssue({ code: "custom", path: ["indexById"], message: "Ожидался позиционный словарь записей." });
				return z.NEVER;
			}

			// Проверка и копирование доставленных чисел происходят одним проходом.
			// z.record здесь не применяется: он удаляет собственный __proto__.
			const indexById = Object.create(null) as Record<string, number>;
			let entries = 0;
			for (const id of Reflect.ownKeys(wire.indexById)) {
				const descriptor = Object.getOwnPropertyDescriptor(wire.indexById, id);
				const position: unknown = descriptor?.value;
				if (
					typeof id !== "string" ||
					!descriptor?.enumerable ||
					!("value" in descriptor) ||
					typeof position !== "number" ||
					!Number.isSafeInteger(position) ||
					position < 0 ||
					position >= wire.items.length ||
					!Object.hasOwn(wire.items, position) ||
					getId(wire.items[position]) !== id
				) {
					context.addIssue({ code: "custom", path: ["indexById"], message: "Индекс не соответствует записям." });
					return z.NEVER;
				}
				indexById[id] = position;
				entries += 1;
			}
			if (entries !== wire.items.length) {
				context.addIssue({ code: "custom", path: ["indexById"], message: "Позиционный индекс неполон." });
				return z.NEVER;
			}

			return Object.freeze({ items: wire.items, indexById: Object.freeze(indexById) });
		});
}
