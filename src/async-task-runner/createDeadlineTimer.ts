import { type DeadlineTimer, type DeadlineTimerOptions } from "./deadlineTimerTypes";

const MAX_NATIVE_DELAY_MS = 2_147_483_647;

type DeadlineGeneration = {
	deadlineAtMs: number;
	timer: ReturnType<typeof setTimeout> | null;
};

/**
 * Ожидает один абсолютный срок. Длинное ожидание разбивается только на native
 * timers: промежуточные части не вызывают предметный callback. Создание не
 * запускает таймер, а отменённое поколение не оживает от позднего callback.
 */
export function createDeadlineTimer({ onDue }: DeadlineTimerOptions): DeadlineTimer {
	let active: DeadlineGeneration | null = null;

	const cancel = (): void => {
		const generation = active;
		active = null;
		if (generation && generation.timer !== null) {
			clearTimeout(generation.timer);
			generation.timer = null;
		}
	};
	const arm = (generation: DeadlineGeneration): void => {
		// Node превращает переполнение delay в 1 ms. Даже годовой deadline нельзя
		// передавать напрямую; оставшийся срок перепроверяется после каждой части.
		const delay = Math.max(1, Math.min(MAX_NATIVE_DELAY_MS, generation.deadlineAtMs - Date.now()));
		const timer = setTimeout(() => {
			if (active !== generation || generation.timer !== timer) return;
			generation.timer = null;
			if (Date.now() < generation.deadlineAtMs) {
				arm(generation);
				return;
			}
			// Срок отзывается до callback: onDue может безопасно назначить следующий.
			// Ошибки и async rejection принадлежат caller, а не timer primitive.
			active = null;
			onDue();
		}, delay);
		generation.timer = timer;
		timer.unref?.();
	};

	return {
		schedule(deadlineAtMs) {
			if (deadlineAtMs === null) {
				cancel();
				return;
			}
			if (!Number.isSafeInteger(deadlineAtMs)) {
				throw new RangeError("Абсолютный срок должен быть безопасным целым числом Unix milliseconds.");
			}
			if (active?.deadlineAtMs === deadlineAtMs) return;
			cancel();
			const generation: DeadlineGeneration = { deadlineAtMs, timer: null };
			active = generation;
			arm(generation);
		},
		cancel
	};
}
