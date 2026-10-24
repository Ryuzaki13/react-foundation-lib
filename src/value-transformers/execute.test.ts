import { afterEach, describe, expect, it, vi } from "vitest";

import {
	compileValueTransformer,
	configureValueTransformerRegistry,
	createValueTransformerRegistry,
	executeValueTransformer
} from "./index";

afterEach(() => configureValueTransformerRegistry(createValueTransformerRegistry([])));

describe("value transformer execution", () => {
	it.each([0, -2.5, 1250, null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
		"сохраняет результат функции буквально: %s",
		(value) => {
			configureValueTransformerRegistry(
				createValueTransformerRegistry([{ id: "chosen", name: "Результат", description: "", fn: () => value }])
			);
			expect(executeValueTransformer({ transformerId: "chosen", value: "исходный ввод" })).toEqual({ ok: true, value });
		}
	);

	it("передаёт исходный объект функции без копирования, coercion или подстановки значения", () => {
		const source = Object.freeze({ amount: "нечисловой ввод" });
		const fn = vi.fn<(value: unknown) => undefined>(() => undefined);
		configureValueTransformerRegistry(createValueTransformerRegistry([{ id: "inspect", name: "Вход", description: "", fn }]));
		expect(executeValueTransformer({ transformerId: "inspect", value: source })).toEqual({ ok: true, value: undefined });
		expect(fn).toHaveBeenCalledExactlyOnceWith(source);
		expect(fn.mock.calls[0]?.[0]).toBe(source);
	});

	it.each(["", "  ", "missing", undefined])("возвращает явную ошибку для неизвестного transformerId %s", (transformerId) => {
		expect(compileValueTransformer({ transformerId })).toEqual({ ok: false, reason: "transformer_not_found" });
		expect(executeValueTransformer({ transformerId, value: 10 })).toEqual({ ok: false, reason: "transformer_not_found" });
	});

	it("превращает исключение функции в runtime_error без копирования исходного ввода в ошибку", () => {
		configureValueTransformerRegistry(
			createValueTransformerRegistry([
				{
					id: "reject",
					name: "Ошибка",
					description: "",
					fn: () => {
						throw new Error("Внутренняя причина функции");
					}
				}
			])
		);
		expect(executeValueTransformer({ transformerId: "reject", value: "внешние данные" })).toEqual({
			ok: false,
			reason: "runtime_error"
		});
	});

	it("фиксирует функцию для повторных запусков независимо от исходного определения и последующей замены registry", () => {
		const definition = {
			id: "scale",
			name: "Удвоение",
			description: "",
			fn: (value: unknown) => (typeof value === "number" ? value * 2 : null)
		};
		const originalFn = vi.fn(definition.fn);
		definition.fn = originalFn;
		configureValueTransformerRegistry(createValueTransformerRegistry([definition]));
		const compiled = compileValueTransformer({ transformerId: " scale " });
		definition.fn = vi.fn(() => 100);
		configureValueTransformerRegistry(createValueTransformerRegistry([{ ...definition, fn: () => 1000 }]));

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.execute(2)).toEqual({ ok: true, value: 4 });
		expect(compiled.execute(3)).toEqual({ ok: true, value: 6 });
		expect(compiled.execute(undefined)).toEqual({ ok: true, value: null });
		expect(originalFn).toHaveBeenCalledTimes(3);
		expect(executeValueTransformer({ transformerId: "scale", value: 2 })).toEqual({ ok: true, value: 1000 });
	});
});
