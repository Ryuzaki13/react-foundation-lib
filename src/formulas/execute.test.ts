import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	compileTableFormula,
	compileTableFormulaWithResolvedArguments,
	createTableFormulaContext,
	executeTableFormula,
	executeTableFormulaWithResolvedArguments,
	type TableFormulaExecutionResult,
	type TableFormulaResolvedExecutor
} from "./execute";
import { configureTableFormulaRegistry, createTableFormulaRegistry } from "./registry";
import { type TableFormulaDefinition, type TableFormulaResolvedArgument } from "./types";

beforeEach(() => {
	configureTableFormulaRegistry(
		createTableFormulaRegistry([
			{
				id: "sum",
				name: "Сумма",
				description: "Складывает два значения.",
				fn: (context) => context.num(0) + context.num(1)
			},
			{
				id: "ratio",
				name: "Отношение",
				description: "Делит первое значение на второе.",
				fn: (context) => {
					const divisor = context.num(1);
					return divisor === 0 ? 0 : context.num(0) / divisor;
				}
			},
			{ id: "invalid", name: "Невалидный результат", description: "Возвращает бесконечность.", fn: () => Infinity },
			{
				id: "runtime-error",
				name: "Ошибка выполнения",
				description: "Имитирует исключение пользовательской формулы.",
				fn: () => {
					throw new Error("Ошибка тестовой формулы");
				}
			}
		])
	);
});

describe("createTableFormulaV2Context", () => {
	it("читает константы по позиции без ключей строки и фиксирует их значения", () => {
		const constant: { kind: "constant"; value: number } = { kind: "constant", value: -2.5 };
		const onReadIndex = vi.fn();
		const onOutOfRangeIndex = vi.fn();
		const ctx = createTableFormulaContext({
			rowData: { A: "10" },
			keys: ["A", constant, { kind: "constant", value: 0 }],
			instrumentation: { onReadIndex, onOutOfRangeIndex }
		});
		constant.value = 100;

		expect(ctx.key(0)).toBe("A");
		expect(ctx.key(1)).toBeUndefined();
		expect(ctx.value(1)).toBe(-2.5);
		expect(ctx.num(1)).toBe(-2.5);
		expect(ctx.value(2)).toBe(0);
		expect(ctx.num(2)).toBe(0);
		expect(onReadIndex).toHaveBeenCalledWith(1);
		expect(onReadIndex).toHaveBeenCalledWith(2);
		expect(onOutOfRangeIndex).not.toHaveBeenCalled();
	});

	it("формирует ctx на основе rowData и keys", () => {
		const onReadIndex = vi.fn();
		const onOutOfRangeIndex = vi.fn();
		const ctx = createTableFormulaContext({
			rowData: { MP_BC: 100, NETWR: "160", TEXT_INVALID: "x" },
			keys: ["MP_BC", "NETWR", "TEXT_INVALID"],
			instrumentation: { onReadIndex, onOutOfRangeIndex }
		});

		expect(ctx.key(0)).toBe("MP_BC");
		expect(ctx.value(0)).toBe(100);
		expect(ctx.value(1)).toBe("160");
		expect(ctx.num(1)).toBe(160);
		expect(ctx.num(2)).toBe(0);
		expect(ctx.key(100)).toBeUndefined();
		expect(ctx.key(-1)).toBeUndefined();
		expect(ctx.key(1.5)).toBeUndefined();
		expect(ctx.value(10)).toBeUndefined();
		expect(ctx.num(10)).toBe(0);
		expect(onReadIndex).toHaveBeenCalledWith(0);
		expect(onReadIndex).toHaveBeenCalledWith(10);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(100);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(-1);
		expect(onOutOfRangeIndex).toHaveBeenCalledWith(1.5);
	});
});

describe("executeTableFormula", () => {
	it.each([
		["ratio", ["A", { kind: "constant", value: 100 }], 0.5],
		["ratio", [{ kind: "constant", value: 100 }, "A"], 2],
		["sum", ["A", { kind: "constant", value: 0 }], 50],
		[
			"sum",
			[
				{ kind: "constant", value: -2.5 },
				{ kind: "constant", value: -2.5 }
			],
			-5
		],
		["sum", ["A", "A"], 100]
	] as const)("передаёт поля и константы в %s с сохранением порядка и повторов", (formulaId, keys, value) => {
		expect(executeTableFormula({ formulaId, keys, rowData: { A: 50 } })).toEqual({ ok: true, value });
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		"отклоняет не конечную константу %s без подмены нулём",
		(value) => {
			const keys = [{ kind: "constant", value }, "A"] as const;
			expect(executeTableFormula({ formulaId: "sum", keys, rowData: { A: 10 } })).toEqual({ ok: false, reason: "runtime_error" });
			expect(() => createTableFormulaContext({ keys, rowData: {} })).toThrow(TypeError);
		}
	);

	it("выполняет формулы активного реестра и защищает деление на ноль", () => {
		expect(executeTableFormula({ formulaId: "sum", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 15
		});
		expect(executeTableFormula({ formulaId: "ratio", rowData: { A: 10, B: 5 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 2
		});
		expect(executeTableFormula({ formulaId: "ratio", rowData: { A: 10, B: 0 }, keys: ["A", "B"] })).toEqual({
			ok: true,
			value: 0
		});
	});

	it("преобразует невалидный результат и исключение формулы в безопасные ошибки", () => {
		expect(executeTableFormula({ formulaId: "invalid", rowData: {} })).toEqual({ ok: false, reason: "invalid_result" });
		expect(executeTableFormula({ formulaId: "runtime-error", rowData: {} })).toEqual({ ok: false, reason: "runtime_error" });
	});

	it("возвращает ошибку, если формула не найдена", () => {
		const result = executeTableFormula({
			formulaId: "missing",
			rowData: { A: 1 },
			keys: ["A"]
		});

		expect(result).toEqual({
			ok: false,
			reason: "formula_not_found"
		});
	});
});

describe("compileTableFormula", () => {
	it("сохраняет значения констант независимо от последующего изменения исходного объекта", () => {
		const constant: { kind: "constant"; value: number } = { kind: "constant", value: 10 };
		const compiled = compileTableFormula({ formulaId: "sum", keys: ["A", constant] });
		constant.value = 100;

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;
		expect(compiled.execute({ A: 2 })).toEqual({ ok: true, value: 12 });
		expect(compiled.execute({ A: 5 })).toEqual({ ok: true, value: 15 });
	});

	it("компилирует формулу и переиспользует контекст между вызовами", () => {
		const compiled = compileTableFormula({
			formulaId: "ratio",
			keys: ["LEFT", "RIGHT"]
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		const first = compiled.execute({ LEFT: 100, RIGHT: 20 });
		const second = compiled.execute({ LEFT: 120, RIGHT: 40 });

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;

		expect(first.value).toBe(5);
		expect(second.value).toBe(3);
	});

	it("компилирует формулу без ключей как безопасное выполнение с нулями", () => {
		const compiled = compileTableFormula({
			formulaId: "sum"
		});

		expect(compiled.ok).toBe(true);
		if (!compiled.ok) return;

		expect(compiled.execute({ A: 10, B: 20 })).toEqual({
			ok: true,
			value: 0
		});
	});

	it("не компилирует пустой formulaId", () => {
		expect(compileTableFormula({ formulaId: undefined })).toEqual({
			ok: false,
			reason: "formula_not_found"
		});
	});
});

/** Один контракт проверяется у обоих публичных способов исполнения, без зависимости от private context builder. */
function resolvedFormulaRunner(formulaId: string, mode: "direct" | "compiled"): TableFormulaResolvedExecutor {
	if (mode === "direct") {
		return (resolvedArguments) => executeTableFormulaWithResolvedArguments({ formulaId, arguments: resolvedArguments });
	}

	const compiled = compileTableFormulaWithResolvedArguments({ formulaId });
	if (!compiled.ok) throw new Error(`Не удалось подготовить тестовую формулу '${formulaId}'.`);

	return compiled.execute;
}

describe.each(["direct", "compiled"] as const)("разрешённые аргументы: %s", (mode) => {
	it.each([
		{ numerator: 20, denominator: 100, value: 0.2 },
		{ numerator: 20, denominator: 40, value: 0.5 },
		{ numerator: 100, denominator: 100, value: 1 },
		{ numerator: 0, denominator: 0, value: 0 },
		{ numerator: 100, denominator: 20, value: 5 }
	])("передаёт подготовленные позиции $numerator / $denominator без смены формулы", ({ numerator, denominator, value }) => {
		const execute = resolvedFormulaRunner("ratio", mode);

		expect(execute([{ value: numerator, key: "AMOUNT" }, { value: denominator }])).toEqual({ ok: true, value });
	});

	it("сохраняет повтор одного аргумента в разных позициях", () => {
		const argument = Object.freeze({ value: 20 });
		const resolvedArguments = Object.freeze([argument, argument]);
		const execute = resolvedFormulaRunner("sum", mode);

		expect(execute(resolvedArguments)).toEqual({ ok: true, value: 40 });
	});

	it("передаёт literal values и local key, сохраняя числовое преобразование и frozen inputs", () => {
		const literalObject = Object.freeze({ source: "literal" });
		const values: unknown[] = [null, undefined, 0, -2.5, "12.5", Number.NaN, Infinity, "не число", true, literalObject];
		const resolvedArguments = Object.freeze(
			values.map((value, index) => Object.freeze(index === 0 ? { value, key: "LOCAL_AMOUNT" } : { value }))
		);
		const readValues: unknown[] = [];
		const readKeys: Array<string | undefined> = [];
		const readNumbers: number[] = [];
		configureTableFormulaRegistry(
			createTableFormulaRegistry([
				{
					id: "inspect",
					name: "Чтение аргументов",
					description: "Проверяет значения без их нормализации и подмены полями строки.",
					fn: (context) => {
						for (const index of values.keys()) {
							readValues.push(context.value(index));
							readKeys.push(context.key(index));
							readNumbers.push(context.num(index));
						}

						return 0;
					}
				}
			])
		);
		const execute = resolvedFormulaRunner("inspect", mode);

		expect(execute(resolvedArguments)).toEqual({ ok: true, value: 0 });
		expect(readValues).toEqual(values);
		expect(readValues.at(-1)).toBe(literalObject);
		expect(readKeys).toEqual([
			"LOCAL_AMOUNT",
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined
		]);
		expect(readNumbers).toEqual([0, 0, 0, -2.5, 12.5, 0, 0, 0, 1, 0]);
		expect(resolvedArguments.map((argument) => argument.value)).toEqual(values);
	});

	it("возвращает пустые значения для недопустимого индекса и позиции за границей массива", () => {
		const indexes = [-1, 0.5, 1, 10, Number.NaN, Infinity, -Infinity];
		const reads: Array<{ key: string | undefined; value: unknown; numeric: number }> = [];
		configureTableFormulaRegistry(
			createTableFormulaRegistry([
				{
					id: "bounds",
					name: "Границы аргументов",
					description: "Неверная позиция не читает случайный аргумент.",
					fn: (context) => {
						for (const index of indexes) {
							reads.push({ key: context.key(index), value: context.value(index), numeric: context.num(index) });
						}

						return 0;
					}
				}
			])
		);
		const execute = resolvedFormulaRunner("bounds", mode);

		expect(execute([{ value: 42, key: "LOCAL_AMOUNT" }])).toEqual({ ok: true, value: 0 });
		expect(reads).toEqual(indexes.map(() => ({ key: undefined, value: undefined, numeric: 0 })));
	});

	it.each(["hole", "missing", "inherited"] as const)("отклоняет неполный вход %s до выполнения формулы", (kind) => {
		const formula = vi.fn(() => 42);
		configureTableFormulaRegistry(
			createTableFormulaRegistry([{ id: "ignores-input", name: "Без чтения", description: "Не читает аргументы.", fn: formula }])
		);
		const resolvedArguments: TableFormulaResolvedArgument[] = [{ value: 1 }, { value: 2 }];
		if (kind === "hole") {
			resolvedArguments.length = 3;
		} else {
			// Воспроизводим повреждённый внешний объект без ослабления public TypeScript-контракта.
			const argument: TableFormulaResolvedArgument = { value: 3 };
			Reflect.deleteProperty(argument, "value");
			if (kind === "inherited") Object.setPrototypeOf(argument, { value: 3 });
			resolvedArguments.push(argument);
		}
		const execute = resolvedFormulaRunner("ignores-input", mode);

		expect(execute(resolvedArguments)).toEqual({ ok: false, reason: "runtime_error" });
		expect(formula).not.toHaveBeenCalled();
	});

	it("применяет нулевое чтение отсутствующих позиций к корректному пустому массиву", () => {
		const execute = resolvedFormulaRunner("sum", mode);

		expect(execute([])).toEqual({ ok: true, value: 0 });
	});

	it.each([Number.NaN, Infinity, -Infinity])("сохраняет безопасную ошибку для результата %s", (value) => {
		configureTableFormulaRegistry(
			createTableFormulaRegistry([
				{ id: "invalid-result", name: "Не конечное число", description: "Не раскрывает входы.", fn: () => value }
			])
		);
		const execute = resolvedFormulaRunner("invalid-result", mode);

		expect(execute([{ value: "SENSITIVE_INPUT" }])).toEqual({ ok: false, reason: "invalid_result" });
	});

	it("скрывает исключения формулы и числового преобразования за прежней причиной", () => {
		const executeThrowing = resolvedFormulaRunner("runtime-error", mode);
		const executeSum = resolvedFormulaRunner("sum", mode);

		expect(executeThrowing([{ value: "SENSITIVE_INPUT" }])).toEqual({ ok: false, reason: "runtime_error" });
		expect(executeSum([{ value: Symbol("SENSITIVE_INPUT") }, { value: 1 }])).toEqual({ ok: false, reason: "runtime_error" });
	});
});

describe("compiled executor разрешённых аргументов", () => {
	it("сохраняет receiver нормализованного определения у прежних и новых entry point", () => {
		const receivers: TableFormulaDefinition[] = [];
		configureTableFormulaRegistry(
			createTableFormulaRegistry([
				{
					id: "receiver",
					name: "  Определение формулы  ",
					description: "Формула читает собственные metadata через receiver.",
					args: ["Значение", "Константа"],
					fn(this: TableFormulaDefinition, context) {
						receivers.push(this);

						return (this.args?.length ?? 0) + context.num(0);
					}
				}
			])
		);
		const rowCompiled = compileTableFormula({ formulaId: "receiver", keys: ["AMOUNT"] });
		if (!rowCompiled.ok) throw new Error("Не удалось подготовить формулу с receiver.");

		expect(rowCompiled.execute({ AMOUNT: 10 })).toEqual({ ok: true, value: 12 });
		expect(executeTableFormula({ formulaId: "receiver", keys: ["AMOUNT"], rowData: { AMOUNT: 10 } })).toEqual({ ok: true, value: 12 });
		expect(resolvedFormulaRunner("receiver", "compiled")([{ value: 10 }])).toEqual({ ok: true, value: 12 });
		expect(executeTableFormulaWithResolvedArguments({ formulaId: "receiver", arguments: [{ value: 10 }] })).toEqual({
			ok: true,
			value: 12
		});
		expect(receivers).toHaveLength(4);
		expect(receivers.every((receiver) => receiver.name === "Определение формулы")).toBe(true);
	});

	it.each(["missing", "", undefined])("сохраняет formula_not_found для ID %s в обоих entry point", (formulaId) => {
		expect(compileTableFormulaWithResolvedArguments({ formulaId })).toEqual({ ok: false, reason: "formula_not_found" });
		expect(executeTableFormulaWithResolvedArguments({ formulaId, arguments: [{ value: 20 }] })).toEqual({
			ok: false,
			reason: "formula_not_found"
		});
	});

	it("читает аргументы каждого вызова заново и продолжает работу после ошибки", () => {
		const execute = resolvedFormulaRunner("ratio", "compiled");
		const first = Object.freeze([Object.freeze({ value: 20 }), Object.freeze({ value: 100 })]);
		const second = Object.freeze([Object.freeze({ value: 20 }), Object.freeze({ value: 40 })]);

		expect(execute(first)).toEqual({ ok: true, value: 0.2 });
		expect(execute(second)).toEqual({ ok: true, value: 0.5 });
		expect(execute([{ value: Symbol("invalid") }, { value: 1 }])).toEqual({ ok: false, reason: "runtime_error" });
		expect(execute(first)).toEqual({ ok: true, value: 0.2 });
	});

	it.each([false, true])("сохраняет внешний контекст при вложенном вызове с ошибкой: %s", (innerThrows) => {
		const nestedResults: TableFormulaExecutionResult[] = [];
		configureTableFormulaRegistry(
			createTableFormulaRegistry([
				{
					id: "nested",
					name: "Вложенный вызов",
					description: "Повторно входит в тот же executor и затем продолжает читать внешний контекст.",
					fn: (context) => {
						if (context.key(0) !== "OUTER") return context.num(0) + context.num(1);

						const first = context.num(0);

						nestedResults.push(execute([{ value: innerThrows ? Symbol("invalid") : 2 }, { value: 3 }]));

						return first + context.num(1);
					}
				}
			])
		);
		const execute = resolvedFormulaRunner("nested", "compiled");

		expect(execute([{ value: 20, key: "OUTER" }, { value: 100 }])).toEqual({ ok: true, value: 120 });
		expect(nestedResults).toEqual([innerThrows ? { ok: false, reason: "runtime_error" } : { ok: true, value: 5 }]);
		expect(execute([{ value: 4 }, { value: 5 }])).toEqual({ ok: true, value: 9 });
	});
});
