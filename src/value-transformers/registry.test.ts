import { afterEach, describe, expect, it } from "vitest";

import {
	configureValueTransformerRegistry,
	createValueTransformerRegistry,
	getValueTransformerById,
	getValueTransformerList
} from "./index";

afterEach(() => configureValueTransformerRegistry(createValueTransformerRegistry([])));

describe("value transformer registry", () => {
	it("создаёт независимые каталоги и не устанавливает созданный каталог автоматически", () => {
		const keywords = ["число"];
		const definition = { id: " identity ", name: " Значение ", description: " Возвращает исходное число. ", keywords, fn: () => 1 };
		const first = createValueTransformerRegistry([definition]);
		const second = createValueTransformerRegistry([]);
		definition.name = "Изменено";
		keywords.push("добавлено");

		expect(first.list[0]).toMatchObject({
			id: "identity",
			name: "Значение",
			description: "Возвращает исходное число.",
			keywords: ["число"]
		});
		expect(first.byId.get("identity")).toBe(first.list[0]);
		expect(second.list).toEqual([]);
		expect(getValueTransformerList()).toEqual([]);
		expect(Object.isFrozen(first)).toBe(true);
		expect(Object.isFrozen(first.list)).toBe(true);
		expect(Object.isFrozen(first.list[0])).toBe(true);
		expect(Object.isFrozen(first.list[0]?.keywords)).toBe(true);
	});

	it("сохраняет отсутствие необязательных keywords", () => {
		const registry = createValueTransformerRegistry([{ id: "zero", name: "Ноль", description: "", fn: () => 0 }]);
		expect(registry.list[0]).not.toHaveProperty("keywords");
	});

	it("отклоняет пустой ID до установки каталога", () => {
		expect(() => createValueTransformerRegistry([{ id: " \t ", name: "", description: "", fn: () => 0 }])).toThrow(
			"не может быть пустым"
		);
	});

	it("отклоняет дубликат после нормализации ID", () => {
		expect(() =>
			createValueTransformerRegistry([
				{ id: "identity", name: "Первое", description: "", fn: () => 0 },
				{ id: " identity ", name: "Второе", description: "", fn: () => 1 }
			])
		).toThrow("дублирующийся transformerId");
	});

	it("устанавливает каталог с устойчивым порядком и находит ID после trim", () => {
		const first = createValueTransformerRegistry([
			{ id: "second", name: "Второе", description: "", fn: () => 2 },
			{ id: "first", name: "Первое", description: "", fn: () => 1 }
		]);
		configureValueTransformerRegistry(first);
		expect(getValueTransformerList()).toBe(first.list);
		expect(getValueTransformerList().map((definition) => definition.id)).toEqual(["second", "first"]);
		expect(getValueTransformerById(" first ")).toBe(first.list[1]);
		for (const id of [undefined, "", " \t", "unknown"]) expect(getValueTransformerById(id)).toBeUndefined();

		configureValueTransformerRegistry(createValueTransformerRegistry([]));
		expect(getValueTransformerList()).toEqual([]);
		expect(first.list).toHaveLength(2);
	});
});
