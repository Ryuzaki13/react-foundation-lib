import { createDeadlineTimer, type DeadlineTimer, type DeadlineTimerOptions } from "../src/async-task-runner";

const options = {
	onDue: () => undefined
} satisfies DeadlineTimerOptions;
const create: (options: DeadlineTimerOptions) => DeadlineTimer = createDeadlineTimer;
const timer = create(options);
const schedule: (deadlineAtMs: number | null) => void = timer.schedule;
const cancel: () => void = timer.cancel;
schedule(Date.now() + 60_000);
schedule(null);
cancel();
void [schedule, cancel];
