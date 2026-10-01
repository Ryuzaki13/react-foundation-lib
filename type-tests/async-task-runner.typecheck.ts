import { createCoalescingTaskRunner, type CoalescingTaskRunner, type CoalescingTaskRunnerOptions } from "../src/async-task-runner";

const options = {
	run: async () => undefined,
	onError: (error: unknown) => {
		void error;
	},
	retryDelayMs: 5000
} satisfies CoalescingTaskRunnerOptions;
const asynchronousReporter = {
	...options,
	onError: async (error: unknown) => {
		void error;
	},
	pollIntervalMs: 60_000
} satisfies CoalescingTaskRunnerOptions;
const create: (options: CoalescingTaskRunnerOptions) => CoalescingTaskRunner = createCoalescingTaskRunner;
const runner = create(options);
const start: () => Promise<void> = runner.start;
const wake: () => Promise<void> = runner.wake;
const stop: () => Promise<void> = runner.stop;
void [asynchronousReporter, start, wake, stop];
