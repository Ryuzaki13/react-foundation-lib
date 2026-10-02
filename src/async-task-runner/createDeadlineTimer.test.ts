import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeadlineTimer } from "./createDeadlineTimer";

const INITIAL_NOW = 1_800_000_000_000;
const MAX_NATIVE_DELAY_MS = 2_147_483_647;

describe("createDeadlineTimer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(INITIAL_NOW);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("создание и отмена пустого timer не создают побочных эффектов", () => {
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.cancel();
		timer.schedule(null);
		expect(vi.getTimerCount()).toBe(0);
		expect(onDue).not.toHaveBeenCalled();
	});

	it("вызывает callback один раз при наступлении срока и освобождает timer", async () => {
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + 10);
		await vi.advanceTimersByTimeAsync(9);
		expect(onDue).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(onDue).toHaveBeenCalledExactlyOnceWith();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(100);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it.each([INITIAL_NOW, INITIAL_NOW - 1, 0, -1, Number.MIN_SAFE_INTEGER])(
		"просроченный срок %s не вызывает callback синхронно",
		async (deadlineAtMs) => {
			const onDue = vi.fn();
			createDeadlineTimer({ onDue }).schedule(deadlineAtMs);
			expect(onDue).not.toHaveBeenCalled();
			expect(vi.getTimerCount()).toBe(1);
			await vi.advanceTimersByTimeAsync(1);
			expect(onDue).toHaveBeenCalledOnce();
			expect(vi.getTimerCount()).toBe(0);
		}
	);

	it("максимальная native задержка не разбивается раньше срока", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const onDue = vi.fn();
		createDeadlineTimer({ onDue }).schedule(INITIAL_NOW + MAX_NATIVE_DELAY_MS);
		expect(setTimeoutSpy).toHaveBeenCalledOnce();
		expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(MAX_NATIVE_DELAY_MS);
		await vi.advanceTimersByTimeAsync(MAX_NATIVE_DELAY_MS);
		expect(onDue).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("разбивает MAX + 1 на безопасные части без промежуточного callback", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const onDue = vi.fn();
		createDeadlineTimer({ onDue }).schedule(INITIAL_NOW + MAX_NATIVE_DELAY_MS + 1);
		await vi.advanceTimersByTimeAsync(MAX_NATIVE_DELAY_MS);
		expect(onDue).not.toHaveBeenCalled();
		expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([MAX_NATIVE_DELAY_MS, 1]);
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(onDue).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("несколько полных частей не выполняют callback и не создают интервалы", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
		const onDue = vi.fn();
		createDeadlineTimer({ onDue }).schedule(INITIAL_NOW + 2 * MAX_NATIVE_DELAY_MS + 7);
		await vi.advanceTimersByTimeAsync(2 * MAX_NATIVE_DELAY_MS);
		expect(onDue).not.toHaveBeenCalled();
		expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([MAX_NATIVE_DELAY_MS, MAX_NATIVE_DELAY_MS, 7]);
		expect(setIntervalSpy).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(7);
		expect(onDue).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(["cancel", "null"])("отмена через %s удаляет ожидание длинного срока", async (mode) => {
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + MAX_NATIVE_DELAY_MS + 10);
		await vi.advanceTimersByTimeAsync(MAX_NATIVE_DELAY_MS);
		if (mode === "cancel") timer.cancel();
		else timer.schedule(null);
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(100);
		expect(onDue).not.toHaveBeenCalled();
	});

	it("замена срока не допускает callback предыдущего срока", async () => {
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + 10);
		timer.schedule(INITIAL_NOW + 20);
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(10);
		expect(onDue).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(10);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it("повтор того же pending срока не перевзводит native timer", () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const timer = createDeadlineTimer({ onDue: vi.fn() });
		timer.schedule(INITIAL_NOW + 10);
		timer.schedule(INITIAL_NOW + 10);
		expect(setTimeoutSpy).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(1);
	});

	it("поздний callback отменённого поколения не срабатывает после новой schedule", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + 10);
		const oldCallback = setTimeoutSpy.mock.calls[0]?.[0];
		if (typeof oldCallback !== "function") throw new Error("Deadline callback не был назначен.");
		timer.cancel();
		timer.schedule(INITIAL_NOW + 20);
		oldCallback();
		expect(onDue).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(20);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it("ранний callback старой части не перевзводит уже заменённый срок", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + MAX_NATIVE_DELAY_MS + 10);
		const oldCallback = setTimeoutSpy.mock.calls[0]?.[0];
		if (typeof oldCallback !== "function") throw new Error("Deadline callback не был назначен.");
		await vi.advanceTimersByTimeAsync(MAX_NATIVE_DELAY_MS);
		timer.schedule(Date.now() + 20);
		oldCallback();
		expect(vi.getTimerCount()).toBe(1);
		expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(20);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it("поздний callback прежней части не добавляет timer тому же поколению", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const onDue = vi.fn();
		createDeadlineTimer({ onDue }).schedule(INITIAL_NOW + MAX_NATIVE_DELAY_MS + 10);
		const oldCallback = setTimeoutSpy.mock.calls[0]?.[0];
		if (typeof oldCallback !== "function") throw new Error("Deadline callback не был назначен.");
		await vi.advanceTimersByTimeAsync(MAX_NATIVE_DELAY_MS);
		oldCallback();
		expect(onDue).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(1);
		expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(10);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it("callback может назначить следующий срок без потери нового timer", async () => {
		const onDue = vi.fn(() => {
			if (onDue.mock.calls.length === 1) timer.schedule(Date.now() + 10);
		});
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + 10);
		await vi.advanceTimersByTimeAsync(10);
		expect(onDue).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(10);
		expect(onDue).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("перевод часов назад не запускает callback раньше абсолютного срока", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const onDue = vi.fn();
		createDeadlineTimer({ onDue }).schedule(INITIAL_NOW + 100);
		vi.setSystemTime(INITIAL_NOW - 50);
		await vi.advanceTimersByTimeAsync(100);
		expect(onDue).not.toHaveBeenCalled();
		expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([100, 50]);
		await vi.advanceTimersByTimeAsync(50);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it("опоздавший после перевода часов вперёд callback срабатывает только один раз", async () => {
		const onDue = vi.fn();
		createDeadlineTimer({ onDue }).schedule(INITIAL_NOW + 100);
		vi.setSystemTime(INITIAL_NOW + 1_000);
		await vi.advanceTimersByTimeAsync(100);
		expect(onDue).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
		"отклоняет некорректный срок %s до побочных эффектов",
		(deadlineAtMs) => {
			const onDue = vi.fn();
			const timer = createDeadlineTimer({ onDue });
			expect(() => timer.schedule(deadlineAtMs)).toThrow(RangeError);
			expect(vi.getTimerCount()).toBe(0);
			expect(onDue).not.toHaveBeenCalled();
		}
	);

	it("некорректная замена не отменяет уже назначенный корректный срок", async () => {
		const onDue = vi.fn();
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + 10);
		expect(() => timer.schedule(Number.NaN)).toThrow(RangeError);
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(10);
		expect(onDue).toHaveBeenCalledOnce();
	});

	it("MAX_SAFE_INTEGER принимается без native overflow", () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		createDeadlineTimer({ onDue: vi.fn() }).schedule(Number.MAX_SAFE_INTEGER);
		expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(MAX_NATIVE_DELAY_MS);
		expect(vi.getTimerCount()).toBe(1);
	});

	it("node timer не удерживает процесс только ради ожидания срока", () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		createDeadlineTimer({ onDue: vi.fn() }).schedule(INITIAL_NOW + 10);
		const handle = setTimeoutSpy.mock.results[0]?.value;
		if (!handle || typeof handle.hasRef !== "function") throw new Error("Не получен Node timer handle.");
		expect(handle.hasRef()).toBe(false);
	});

	it("синхронная ошибка callback не оставляет активный deadline", async () => {
		const failure = new Error("onDue failed");
		const onDue = vi.fn(() => {
			throw failure;
		});
		const timer = createDeadlineTimer({ onDue });
		timer.schedule(INITIAL_NOW + 10);
		await expect(vi.advanceTimersByTimeAsync(10)).rejects.toBe(failure);
		expect(onDue).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		timer.cancel();
	});
});
