// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { isDomReference } from "./isDomReference";
import { isImageExtension } from "./isImageExtension";
import { asRecord, isObject, isPlainObject, isRecord } from "./isRecord";
import { isSafe } from "./isSafe";

describe("validators", () => {
	it("отличает object-like значения от массивов и null", () => {
		expect(isObject({ value: 1 })).toBe(true);
		expect(isObject(new Date())).toBe(true);
		expect(isObject([])).toBe(false);
		expect(isObject(null)).toBe(false);
	});

	it("возвращает record только для object-like значений", () => {
		const value = { code: "A" };

		expect(isRecord(value)).toBe(true);
		expect(asRecord(value)).toBe(value);
		expect(asRecord(["A"])).toBeNull();
	});

	it("проверяет именно plain object по prototype", () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject(Object.create(null) as object)).toBe(true);
		expect(isPlainObject(new Date())).toBe(false);
	});

	it("сужает nullish-значения", () => {
		const values = [0, "", false, null, undefined, "ok"];

		expect(values.filter(isSafe)).toEqual([0, "", false, "ok"]);
	});

	it("проверяет расширения изображений без учета регистра", () => {
		expect(isImageExtension("PNG")).toBe(true);
		expect(isImageExtension("svg")).toBe(true);
		expect(isImageExtension("pdf")).toBe(false);
	});

	it("распознает DOM reference только для Element", () => {
		const element = document.createElement("button");

		expect(isDomReference(element)).toBe(true);
		expect(isDomReference(null)).toBe(false);
	});
});
