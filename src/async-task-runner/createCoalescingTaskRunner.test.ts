import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type CoalescingTaskRunner, type CoalescingTaskRunnerOptions } from "./asyncTaskRunnerTypes";
import { createCoalescingTaskRunner } from "./createCoalescingTaskRunner";

type TaskGate = Readonly<{ promise: Promise<void>; release: () => void; reject: (error: unknown) => void }>;

/** Управляет завершением callback без Promise.withResolvers: публичный пакет рассчитан на ES2022. */
function createTaskGate(): TaskGate {
	let release: (() => void) | undefined;
	let reject: ((error: unknown) => void) | undefined;
	const promise = new Promise<void>((resolve, rejectPromise) => {
		release = resolve;
		reject = rejectPromise;
	});
	return {
		promise,
		release() {
			if (!release) throw new Error("Gate ещё не создан.");
			release();
		},
		reject(error) {
			if (!reject) throw new Error("Gate ещё не создан.");
			reject(error);
		}
	};
}

describe("createCoalescingTaskRunner", () => {
	let runners: CoalescingTaskRunner[];
	let gates: TaskGate[];
	const gate = () => {
		const created = createTaskGate();
		gates.push(created);
		return created;
	};
	const runner = (options: CoalescingTaskRunnerOptions) => {
		const created = createCoalescingTaskRunner(options);
		runners.push(created);
		return created;
	};
	beforeEach(() => {
		vi.useFakeTimers();
		runners = [];
		gates = [];
	});
	afterEach(async () => {
		for (const pendingGate of gates) pendingGate.release();
		for (const created of runners) {
			// Отказ reporter проверяется самим сценарием; teardown только освобождает ресурс.
			await created.stop().catch(() => {});
		}
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("не запускает задачу и таймеры при создании, wake и stop неактивного runner", async () => {
		const run = vi.fn(async () => undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10, pollIntervalMs: 20 });
		await created.wake();
		await created.stop();
		expect(run).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("начинает первую попытку после microtask и без неявного polling", async () => {
		const run = vi.fn(async () => undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const started = created.start();
		expect(run).not.toHaveBeenCalled();
		await started;
		expect(run).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("повторные start присоединяются к попытке, но не запрашивают хвост", async () => {
		const current = gate();
		const run = vi.fn(() => current.promise);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const first = created.start();
		expect(created.start()).toBe(first);
		current.release();
		await first;
		await created.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("объединяет burst wake в один хвост, promise относится только текущему проходу", async () => {
		const firstGate = gate();
		const secondGate = gate();
		const run = vi
			.fn()
			.mockImplementationOnce(() => firstGate.promise)
			.mockImplementationOnce(() => secondGate.promise);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const first = created.start();
		for (let index = 0; index < 20; index++) expect(created.wake()).toBe(first);
		await Promise.resolve();
		expect(run).toHaveBeenCalledTimes(1);
		firstGate.release();
		await first;
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledTimes(2);
		secondGate.release();
		await created.stop();
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("сигналы во время хвоста допускают только один следующий проход без параллельных run", async () => {
		const firstGate = gate();
		const secondGate = gate();
		let concurrency = 0;
		let maximumConcurrency = 0;
		let attempt = 0;
		const run = vi.fn(async () => {
			concurrency++;
			maximumConcurrency = Math.max(maximumConcurrency, concurrency);
			attempt++;
			if (attempt === 1) await firstGate.promise;
			if (attempt === 2) await secondGate.promise;
			concurrency--;
		});
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const first = created.start();
		created.wake();
		firstGate.release();
		await first;
		await vi.advanceTimersByTimeAsync(0);
		const second = created.wake();
		for (let index = 0; index < 20; index++) expect(created.wake()).toBe(second);
		secondGate.release();
		await second;
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledTimes(3);
		expect(maximumConcurrency).toBe(1);
	});

	it("передаёт синхронный отказ run и повторяет через явную задержку", async () => {
		const error = new Error("task");
		const run = vi
			.fn()
			.mockImplementationOnce(() => {
				throw error;
			})
			.mockResolvedValue(undefined);
		const onError = vi.fn();
		const created = runner({ run, onError, retryDelayMs: 10 });
		await expect(created.start()).rejects.toBe(error);
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		await vi.advanceTimersByTimeAsync(9);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("ожидает асинхронный reporter до отклонения попытки и начала retry", async () => {
		const error = new Error("task");
		const reportGate = gate();
		const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const onError = vi.fn(() => reportGate.promise);
		const created = runner({ run, onError, retryDelayMs: 10 });
		const failed = expect(created.start()).rejects.toBe(error);
		await vi.advanceTimersByTimeAsync(20);
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(run).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		reportGate.release();
		await failed;
		await vi.advanceTimersByTimeAsync(9);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("poll вызывает проходы и полностью удаляется при stop", async () => {
		const run = vi.fn(async () => undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10, pollIntervalMs: 20 });
		await created.start();
		await vi.advanceTimersByTimeAsync(40);
		expect(run).toHaveBeenCalledTimes(3);
		await created.stop();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(100);
		expect(run).toHaveBeenCalledTimes(3);
	});

	it("poll не обходит backoff, а повторный start также не ускоряет retry", async () => {
		const error = new Error("task");
		const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10, pollIntervalMs: 2 });
		await expect(created.start()).rejects.toBe(error);
		await created.start();
		await vi.advanceTimersByTimeAsync(9);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("накопленный wake при отказе не заменяет delayed retry немедленным хвостом", async () => {
		const pending = gate();
		const error = new Error("task");
		const run = vi
			.fn()
			.mockImplementationOnce(() => pending.promise)
			.mockResolvedValue(undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const first = created.start();
		const failed = expect(first).rejects.toBe(error);
		expect(created.wake()).toBe(first);
		await Promise.resolve();
		pending.reject(error);
		await failed;
		await vi.advanceTimersByTimeAsync(9);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("явный wake ускоряет retry и удаляет прежний таймер", async () => {
		const error = new Error("task");
		const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		await expect(created.start()).rejects.toBe(error);
		await created.wake();
		expect(run).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(20);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("поздний callback старого поколения не пробуждает новое после restart", async () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const error = new Error("task");
		const run = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		await expect(created.start()).rejects.toBe(error);
		const oldCallback = setTimeoutSpy.mock.calls[0]?.[0];
		if (typeof oldCallback !== "function") throw new Error("Retry callback не был запланирован.");
		await created.stop();
		await created.start();
		oldCallback();
		await vi.advanceTimersByTimeAsync(20);
		expect(run).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("stop сразу отзывает хвост и разделяет один drain promise", async () => {
		const current = gate();
		const run = vi.fn(() => current.promise);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10, pollIntervalMs: 20 });
		const first = created.start();
		created.wake();
		await Promise.resolve();
		const drain = created.stop();
		expect(created.stop()).toBe(drain);
		expect(vi.getTimerCount()).toBe(0);
		current.release();
		await first;
		await drain;
		await vi.advanceTimersByTimeAsync(100);
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("stop до первой microtask не допускает поздний callback", async () => {
		const run = vi.fn(async () => undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10, pollIntervalMs: 20 });
		const first = created.start();
		const drain = created.stop();
		await first;
		await drain;
		expect(run).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("отказ уже начатой задачи после stop всё равно ожидает reporter без новых таймеров", async () => {
		const current = gate();
		const reportGate = gate();
		const error = new Error("task");
		const onError = vi.fn(() => reportGate.promise);
		const created = runner({ run: () => current.promise, onError, retryDelayMs: 10, pollIntervalMs: 20 });
		const failed = expect(created.start()).rejects.toBe(error);
		await Promise.resolve();
		let drained = false;
		const drain = created.stop().then(() => {
			drained = true;
		});
		current.reject(error);
		await vi.advanceTimersByTimeAsync(100);
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(drained).toBe(false);
		reportGate.release();
		await failed;
		await drain;
		expect(vi.getTimerCount()).toBe(0);
	});

	it("restart ждёт drain, а несколько ожидающих start создают одну попытку", async () => {
		const current = gate();
		const run = vi
			.fn()
			.mockImplementationOnce(() => current.promise)
			.mockResolvedValue(undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const first = created.start();
		await Promise.resolve();
		const drain = created.stop();
		const restart = created.start();
		const repeatedRestart = created.start();
		expect(run).toHaveBeenCalledTimes(1);
		current.release();
		await first;
		await drain;
		await restart;
		await repeatedRestart;
		expect(run).toHaveBeenCalledTimes(2);
	});

	it("более поздний stop отменяет ожидающий restart, после drain допустим новый явный start", async () => {
		const current = gate();
		const run = vi
			.fn()
			.mockImplementationOnce(() => current.promise)
			.mockResolvedValue(undefined);
		const created = runner({ run, onError: vi.fn(), retryDelayMs: 10 });
		const first = created.start();
		await Promise.resolve();
		const drain = created.stop();
		const cancelled = expect(created.start()).rejects.toThrow("отменён более поздней остановкой");
		expect(created.stop()).toBe(drain);
		current.release();
		await first;
		await drain;
		await cancelled;
		await vi.advanceTimersByTimeAsync(0);
		expect(run).toHaveBeenCalledTimes(1);
		await created.start();
		expect(run).toHaveBeenCalledTimes(2);
	});

	it.each([new Error("reporter"), undefined, null, "reporter"])(
		"сохраняет точный синхронный отказ reporter %s до stop/drain",
		async (reporterError) => {
			const taskError = new Error("task");
			const run = vi.fn().mockRejectedValueOnce(taskError).mockResolvedValue(undefined);
			const onError = vi.fn().mockImplementationOnce(() => {
				throw reporterError;
			});
			const created = runner({ run, onError, retryDelayMs: 10, pollIntervalMs: 20 });
			await expect(created.start()).rejects.toBe(taskError);
			expect(vi.getTimerCount()).toBe(0);
			await expect(created.start()).rejects.toBe(reporterError);
			await expect(created.wake()).rejects.toBe(reporterError);
			await vi.advanceTimersByTimeAsync(100);
			expect(run).toHaveBeenCalledTimes(1);
			await expect(created.stop()).rejects.toBe(reporterError);
			await created.start();
			expect(run).toHaveBeenCalledTimes(2);
		}
	);

	it("асинхронный отказ reporter после stop отклоняет drain точной ошибкой", async () => {
		const reportGate = gate();
		const taskError = new Error("task");
		const reporterError = new Error("reporter");
		const onError = vi.fn(() => reportGate.promise);
		const created = runner({
			run: async () => {
				throw taskError;
			},
			onError,
			retryDelayMs: 10
		});
		const failed = expect(created.start()).rejects.toBe(taskError);
		await vi.advanceTimersByTimeAsync(0);
		expect(onError).toHaveBeenCalledTimes(1);
		const rejectedDrain = expect(created.stop()).rejects.toBe(reporterError);
		reportGate.reject(reporterError);
		await failed;
		await rejectedDrain;
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(["sync", "async"])("фоновые ошибки и отказ %s reporter не создают unhandled rejection", async (mode) => {
		const taskError = new Error("task");
		const reporterError = new Error("reporter");
		const run = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(taskError);
		const onError = vi.fn(() => {
			if (mode === "sync") throw reporterError;
			return Promise.reject(reporterError);
		});
		const created = runner({ run, onError, retryDelayMs: 10, pollIntervalMs: 20 });
		await created.start();
		await vi.advanceTimersByTimeAsync(100);
		expect(run).toHaveBeenCalledTimes(2);
		expect(onError).toHaveBeenCalledExactlyOnceWith(taskError);
		expect(vi.getTimerCount()).toBe(0);
		await expect(created.stop()).rejects.toBe(reporterError);
	});

	it("обычные фоновые отказы сообщаются и повторяются без unhandled rejection", async () => {
		const error = new Error("task");
		const run = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const onError = vi.fn();
		const created = runner({ run, onError, retryDelayMs: 10, pollIntervalMs: 20 });
		await created.start();
		await vi.advanceTimersByTimeAsync(30);
		expect(run).toHaveBeenCalledTimes(3);
		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
	});

	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
		"отклоняет неправильную задержку retry %s до побочных эффектов",
		(retryDelayMs) => {
			const run = vi.fn(async () => undefined);
			expect(() => createCoalescingTaskRunner({ run, onError: vi.fn(), retryDelayMs })).toThrow(RangeError);
			expect(run).not.toHaveBeenCalled();
			expect(vi.getTimerCount()).toBe(0);
		}
	);

	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
		"отклоняет неправильный период poll %s до побочных эффектов",
		(pollIntervalMs) => {
			const run = vi.fn(async () => undefined);
			expect(() => createCoalescingTaskRunner({ run, onError: vi.fn(), retryDelayMs: 10, pollIntervalMs })).toThrow(RangeError);
			expect(run).not.toHaveBeenCalled();
			expect(vi.getTimerCount()).toBe(0);
		}
	);

	it("принимает максимальные native delay без создания таймеров до start", () => {
		runner({ run: async () => undefined, onError: vi.fn(), retryDelayMs: 2_147_483_647, pollIntervalMs: 2_147_483_647 });
		expect(vi.getTimerCount()).toBe(0);
	});
});
