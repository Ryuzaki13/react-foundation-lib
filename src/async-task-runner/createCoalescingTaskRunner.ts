import { type CoalescingTaskRunner, type CoalescingTaskRunnerOptions } from "./asyncTaskRunnerTypes";

type ScheduledWake = { kind: "retry" | "tail"; timer: ReturnType<typeof setTimeout> };
type RunnerGeneration = {
	pending: Promise<void> | null;
	rerun: boolean;
	pollTimer: ReturnType<typeof setInterval> | null;
	scheduledWake: ScheduledWake | null;
	reportingFailure: Readonly<{ error: unknown }> | null;
};

/**
 * Создаёт неактивный runner. Поколение защищает от поздних таймеров, single-flight
 * объединяет сигналы в один следующий проход, stop не имитирует отмену уже
 * выполняющейся атомарной задачи. Предметная запись и диагностика принадлежат caller.
 */
export function createCoalescingTaskRunner(options: CoalescingTaskRunnerOptions): CoalescingTaskRunner {
	for (const delay of [options.retryDelayMs, ...(options.pollIntervalMs === undefined ? [] : [options.pollIntervalMs])]) {
		// Более длинную задержку Node превращает в 1 ms: молчаливое ограничение здесь опасно.
		if (!Number.isInteger(delay) || delay < 1 || delay > 2_147_483_647) {
			throw new RangeError("Задержки runner должны быть целыми числами от 1 до 2147483647 ms.");
		}
	}
	let active: RunnerGeneration | null = null;
	let stopping: Promise<void> | null = null;
	let stopRevision = 0;

	const clearScheduledWake = (generation: RunnerGeneration) => {
		if (generation.scheduledWake) clearTimeout(generation.scheduledWake.timer);
		generation.scheduledWake = null;
	};
	const clearTimers = (generation: RunnerGeneration) => {
		clearScheduledWake(generation);
		if (generation.pollTimer !== null) clearInterval(generation.pollTimer);
		generation.pollTimer = null;
	};
	const backgroundWake = (generation: RunnerGeneration) => {
		if (active !== generation || generation.reportingFailure || generation.scheduledWake?.kind === "retry") return;
		// Обычный отказ уже передан onError; отказ самого onError сохранён для
		// admission/stop. Timer не создаёт unhandled rejection и не теряет reporter error.
		void wake().catch(() => {});
	};
	const schedule = (generation: RunnerGeneration, kind: ScheduledWake["kind"], delay: number) => {
		if (active !== generation || generation.reportingFailure || generation.scheduledWake) return;
		const timer = setTimeout(() => {
			if (active !== generation || generation.scheduledWake?.timer !== timer) return;
			generation.scheduledWake = null;
			backgroundWake(generation);
		}, delay);
		generation.scheduledWake = { kind, timer };
		timer.unref?.();
	};
	const wake = (): Promise<void> => {
		const generation = active;
		if (!generation) return Promise.resolve();
		if (generation.reportingFailure) return Promise.reject(generation.reportingFailure.error);
		if (generation.pending) {
			generation.rerun = true;
			return generation.pending;
		}
		// Явный wake ускоряет retry. Только caller, не poll, может принять это решение.
		clearScheduledWake(generation);
		generation.rerun = false;
		generation.pending = Promise.resolve()
			.then(async () => {
				// stop до первой microtask не разрешает позднее выполнение callback.
				if (active === generation) await options.run();
			})
			.catch(async (error: unknown) => {
				// Уже начатый run сообщает отказ даже после stop; shutdown не скрывает ошибку.
				try {
					await options.onError(error);
				} catch (reporterError: unknown) {
					// Wrapper различает отсутствие отказа и реальные throw undefined/null.
					generation.reportingFailure = { error: reporterError };
					generation.rerun = false;
					clearTimers(generation);
				}
				schedule(generation, "retry", options.retryDelayMs);
				throw error;
			})
			.finally(() => {
				generation.pending = null;
				// При отказе retry timer уже существует и не заменяется немедленным хвостом.
				if (generation.rerun) schedule(generation, "tail", 0);
			});
		return generation.pending;
	};
	const startGeneration = (requestedBeforeStop: number): Promise<void> => {
		if (requestedBeforeStop !== stopRevision) return Promise.reject(new Error("Запуск runner отменён более поздней остановкой."));
		if (active) {
			if (active.reportingFailure) return Promise.reject(active.reportingFailure.error);
			// Повторный start не является wake и не создаёт лишний хвост или обход retry.
			return active.pending ?? Promise.resolve();
		}
		const generation: RunnerGeneration = { pending: null, rerun: false, pollTimer: null, scheduledWake: null, reportingFailure: null };
		active = generation;
		if (options.pollIntervalMs !== undefined) {
			generation.pollTimer = setInterval(() => backgroundWake(generation), options.pollIntervalMs);
			generation.pollTimer.unref?.();
		}
		return wake();
	};
	return {
		start() {
			const requestedBeforeStop = stopRevision;
			return stopping ? stopping.then(() => startGeneration(requestedBeforeStop)) : startGeneration(requestedBeforeStop);
		},
		wake,
		stop() {
			stopRevision++;
			if (stopping) return stopping;
			const generation = active;
			if (!generation) return Promise.resolve();
			active = null;
			generation.rerun = false;
			clearTimers(generation);
			stopping = (async () => {
				// Task failure уже обработан onError и остаётся у start/wake caller;
				// drain отдельно передаёт точный отказ reporter, если тот не сработал.
				await generation.pending?.catch(() => {});
				if (generation.reportingFailure) throw generation.reportingFailure.error;
			})().finally(() => {
				stopping = null;
			});
			return stopping;
		}
	};
}
