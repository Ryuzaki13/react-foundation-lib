import { createElement, Fragment } from "react";

import { describe, expect, it } from "vitest";

import { childrenCount } from "./childrenCount";
import { cn } from "./cn";
import { deepCloneWithoutFunctions } from "./deepCloneWithoutFunctions";
import { deepCopyWithoutFunctions } from "./deepCopyWithoutFunctions";
import { stableStringify } from "./stableStringify";
import { encodeBase64, toBase64 } from "./toBase64";
import { deepCopyNodes, deepCopyTree } from "./treeNode";

function decodeBase64(value: string): string {
	const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

describe("utils", () => {
	it("считает детей внутри фрагментов как плоский список", () => {
		const tree = createElement(
			Fragment,
			null,
			createElement("span"),
			createElement(Fragment, null, createElement("span"), createElement("span")),
			null
		);

		expect(childrenCount(tree)).toBe(3);
	});

	it("собирает className из строк и условных словарей", () => {
		expect(cn("base", false, undefined, { active: true, hidden: false }, "tail")).toBe("base active tail");
		expect(cn()).toBe("");
	});

	it("стабильно сериализует объекты независимо от порядка ключей", () => {
		const first = { b: 2, a: { d: 4, c: 3 }, list: [{ y: 2, x: 1 }] };
		const second = { list: [{ x: 1, y: 2 }], a: { c: 3, d: 4 }, b: 2 };

		expect(stableStringify(first)).toBe(stableStringify(second));
	});

	it("копирует tree nodes без сохранения ссылок на вложенные children", () => {
		const nodes = [{ id: "root", children: [{ id: "child" }] }];
		const copy = deepCopyNodes(nodes);

		expect(copy).toEqual(nodes);
		expect(copy).not.toBe(nodes);
		expect(copy[0]?.children).not.toBe(nodes[0]?.children);
	});

	it("копирует дерево с настраиваемым полем детей", () => {
		const nodes = [{ id: "root", items: [{ id: "child" }] }];
		const copy = deepCopyTree(nodes, "items");

		expect(copy).toEqual(nodes);
		expect(copy[0]?.items).not.toBe(nodes[0]?.items);
	});

	it("удаляет функции из plain object и массивов при глубоком копировании", () => {
		const source = {
			id: "A",
			skip: () => "ignored",
			nested: { value: 1 },
			items: [1, () => 2, 3],
			createdAt: new Date("2026-01-02T00:00:00.000Z")
		};

		const copy = deepCopyWithoutFunctions(source);

		expect(copy).toEqual({
			id: "A",
			nested: { value: 1 },
			items: [1, 3],
			createdAt: new Date("2026-01-02T00:00:00.000Z")
		});
		expect(copy.nested).not.toBe(source.nested);
		expect(copy.createdAt).not.toBe(source.createdAt);
	});

	it("сохраняет индексную структуру массивов при явной стратегии undefined", () => {
		expect(deepCopyWithoutFunctions([1, () => 2, 3], { arrayFunctionStrategy: "undefined" })).toEqual([1, undefined, 3]);
	});

	it("ошибается при deepCopyWithoutFunctions для неподдержанных объектов", () => {
		expect(() => deepCopyWithoutFunctions(new Map([["key", "value"]]))).toThrow("Unsupported object for config clone");
		expect(deepCopyWithoutFunctions(() => "skip")).toBeUndefined();
	});

	it("глубоко клонирует Date, RegExp, Map, Set и циклические ссылки", () => {
		const source: Record<string, unknown> = {
			date: new Date("2026-01-02T00:00:00.000Z"),
			regexp: /test/gi,
			map: new Map([["key", { value: 1 }]]),
			set: new Set([1, () => 2, 3])
		};
		source.self = source;

		const clone = deepCloneWithoutFunctions(source);

		expect(clone).not.toBe(source);
		expect(clone.self).toBe(clone);
		expect(clone.date).toEqual(source.date);
		expect(clone.date).not.toBe(source.date);
		expect(clone.regexp).toEqual(source.regexp);
		expect(clone.map).toEqual(source.map);
		expect(clone.map).not.toBe(source.map);
		expect(clone.set).toEqual(new Set([1, 3]));
	});

	it("deepCloneWithoutFunctions поддерживает sparse arrays и стратегию omit", () => {
		const source = [1, , () => 2, 3];
		const indexedClone = deepCloneWithoutFunctions(source);
		const omittedClone = deepCloneWithoutFunctions(source, { arrayFunctionStrategy: "omit" });

		expect(indexedClone).toHaveLength(4);
		expect(1 in indexedClone).toBe(false);
		expect(indexedClone[2]).toBeUndefined();
		expect(omittedClone).toEqual([1, 3]);
	});

	it("deepCloneWithoutFunctions сохраняет RegExp.lastIndex и пропускает функции в Map", () => {
		const regexp = /test/g;
		regexp.lastIndex = 2;
		const source = new Map<unknown, unknown>([
			[() => "key", "skip-key"],
			["skip-value", () => "value"],
			["regexp", regexp]
		]);

		const clone = deepCloneWithoutFunctions(source);
		const clonedRegExp = clone.get("regexp");

		expect([...clone.keys()]).toEqual(["regexp"]);
		expect(clonedRegExp).toBeInstanceOf(RegExp);
		expect((clonedRegExp as RegExp).lastIndex).toBe(2);
		expect(clonedRegExp).not.toBe(regexp);
	});

	it("deepCloneWithoutFunctions не вызывает getters и сохраняет дескрипторы data-свойств", () => {
		const secret = Symbol("secret");
		let getterCalls = 0;
		const source: Record<PropertyKey, unknown> = { visible: 1, skip: () => "ignored" };
		Object.defineProperty(source, "hidden", {
			value: { nested: true },
			enumerable: false,
			writable: false,
			configurable: false
		});
		Object.defineProperty(source, "computed", {
			get() {
				getterCalls += 1;
				return "computed";
			}
		});
		Object.defineProperty(source, secret, {
			value: "symbol-value",
			enumerable: true
		});

		const clone = deepCloneWithoutFunctions(source);
		const hiddenDescriptor = Object.getOwnPropertyDescriptor(clone, "hidden");

		expect(getterCalls).toBe(0);
		expect("computed" in clone).toBe(false);
		expect("skip" in clone).toBe(false);
		expect(clone[secret]).toBe("symbol-value");
		expect(hiddenDescriptor).toMatchObject({
			enumerable: false,
			writable: false,
			configurable: false,
			value: { nested: true }
		});
		expect(hiddenDescriptor?.value).not.toBe(source.hidden);
	});

	it("deepCloneWithoutFunctions управляет сохранением prototype", () => {
		class SourceModel {
			value = 1;
		}
		const source = new SourceModel();

		const plainClone = deepCloneWithoutFunctions(source);
		const prototypeClone = deepCloneWithoutFunctions(source, { preservePrototype: true });

		expect(plainClone).not.toBeInstanceOf(SourceModel);
		expect(prototypeClone).toBeInstanceOf(SourceModel);
		expect(prototypeClone).not.toBe(source);
	});

	it("кодирует unicode-строку в base64 без потери символов", () => {
		expect(decodeBase64(toBase64("Привет"))).toBe("Привет");
		expect(decodeBase64(encodeBase64("Привет"))).toBe("Привет");
	});
});
