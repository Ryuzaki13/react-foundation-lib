import { describe, expect, it } from "vitest";

import { resolveCurrencyAwareLabel, resolveCurrencyModeFromODataParameters } from "./currency";

describe("currency", () => {
	it("не определяет режим, если p_curr отсутствует", () => {
		expect(resolveCurrencyModeFromODataParameters()).toBeNull();
		expect(resolveCurrencyModeFromODataParameters({ p_other: { value: true } })).toBeNull();
	});

	it("определяет внутреннюю валюту по p_curr=false", () => {
		expect(resolveCurrencyModeFromODataParameters({ p_curr: { value: false } })).toBe("internal");
	});

	it("определяет рубли по p_curr=true", () => {
		expect(resolveCurrencyModeFromODataParameters({ p_curr: { value: true } })).toBe("rub");
	});

	it("не определяет режим для не-boolean p_curr", () => {
		expect(resolveCurrencyModeFromODataParameters({ p_curr: { value: "true" } })).toBeNull();
	});

	it("оставляет базовую подпись без currencyLabels", () => {
		expect(resolveCurrencyAwareLabel("Выручка", undefined, "rub")).toBe("Выручка");
	});

	it("оставляет базовую подпись без режима валюты", () => {
		expect(resolveCurrencyAwareLabel("Выручка", ["ВВ", "руб"], null)).toBe("Выручка");
	});

	it("добавляет подпись внутренней валюты", () => {
		expect(resolveCurrencyAwareLabel("Выручка", ["за тн", "руб/тн"], "internal")).toBe("Выручка за тн");
	});

	it("добавляет подпись рублей", () => {
		expect(resolveCurrencyAwareLabel("Выручка", ["за тн", "руб/тн"], "rub")).toBe("Выручка руб/тн");
	});

	it("не добавляет пробел перед суффиксом с запятой", () => {
		expect(resolveCurrencyAwareLabel("Выручка", [", за тн", ", руб/тн"], "rub")).toBe("Выручка, руб/тн");
	});

	it("не добавляет запятую для пустого валютного суффикса", () => {
		expect(resolveCurrencyAwareLabel("Выручка", ["", "   "], "rub")).toBe("Выручка");
	});
});
