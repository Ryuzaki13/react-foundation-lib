// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearErrorReportBreadcrumbs, getErrorReportBreadcrumbs } from "./breadcrumbs";
import { captureRuntimeErrorReport } from "./capture";
import { setErrorReportRuntimeErrorReporter } from "./runtime";
import {
	clearRuntimeErrorReportDeduplication,
	coalesceRuntimeErrorReportCapture,
	RUNTIME_ERROR_REPORT_DEDUPLICATION_WINDOW_MS
} from "./runtimeDeduplication";

function createRuntimeError(stackTrace = "Error: Maximum update depth exceeded\n    at Transitioner.tsx:27:3") {
	const error = new Error("Maximum update depth exceeded");
	error.stack = stackTrace;
	return error;
}

function getRuntimeErrorBreadcrumbs() {
	return getErrorReportBreadcrumbs().filter((breadcrumb) => breadcrumb.type === "runtime-error");
}

function createDeduplicationInput(stackTrace = "Error: test\n    at capture.tsx:1:1") {
	return {
		category: "runtime" as const,
		source: "runtime",
		error: {
			name: "Error",
			message: "test",
			stackTrace
		},
		pathname: "/arm/app/checking-wagons"
	};
}

beforeEach(() => {
	clearErrorReportBreadcrumbs();
	clearRuntimeErrorReportDeduplication();
	window.history.replaceState({}, "", "/arm/app/checking-wagons");
});

afterEach(() => {
	setErrorReportRuntimeErrorReporter(undefined);
	clearErrorReportBreadcrumbs();
	vi.useRealTimers();
});

describe("captureRuntimeErrorReport deduplication", () => {
	it("сворачивает burst из 52 одинаковых unhandled rejection в один capture", async () => {
		const errors = Array.from({ length: 52 }, () => createRuntimeError());
		const captures = errors.map((error) =>
			captureRuntimeErrorReport(error, {
				detail: { source: "unhandled_rejection" }
			})
		);

		expect(new Set(captures).size).toBe(1);
		await Promise.all(captures);

		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(1);
	});

	it("различает источник события, stacktrace и pathname", async () => {
		await captureRuntimeErrorReport(createRuntimeError(), {
			detail: { source: "unhandled_rejection" }
		});
		await captureRuntimeErrorReport(createRuntimeError(), {
			detail: { source: "window_error" }
		});
		await captureRuntimeErrorReport(createRuntimeError("Error: Maximum update depth exceeded\n    at Other.tsx:10:2"), {
			detail: { source: "unhandled_rejection" }
		});

		window.history.replaceState({}, "", "/arm/app/customer-complaints");
		await captureRuntimeErrorReport(createRuntimeError(), {
			detail: { source: "unhandled_rejection" }
		});

		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(4);
	});

	it("не склеивает разные вложенные detail и нижние stack frames", async () => {
		const commonStack = Array.from({ length: 10 }, (_, index) => `    at framework-${index}.tsx:1:1`).join("\n");

		await captureRuntimeErrorReport(createRuntimeError(`Error: test\n${commonStack}\n    at feature-a.tsx:1:1`), {
			detail: { transport: { request: { endpoint: "A" } } }
		});
		await captureRuntimeErrorReport(createRuntimeError(`Error: test\n${commonStack}\n    at feature-b.tsx:1:1`), {
			detail: { transport: { request: { endpoint: "A" } } }
		});
		await captureRuntimeErrorReport(createRuntimeError(`Error: test\n${commonStack}\n    at feature-a.tsx:1:1`), {
			detail: { transport: { request: { endpoint: "B" } } }
		});

		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(3);
	});

	it("разрешает новый capture после завершения окна дедупликации", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);

		await captureRuntimeErrorReport(createRuntimeError());
		await captureRuntimeErrorReport(createRuntimeError());
		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(1);

		vi.advanceTimersByTime(RUNTIME_ERROR_REPORT_DEDUPLICATION_WINDOW_MS);
		await captureRuntimeErrorReport(createRuntimeError());

		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(2);
	});

	it("очищает дедупликацию при смене app-level runtime reporter", async () => {
		await captureRuntimeErrorReport(createRuntimeError());
		await captureRuntimeErrorReport(createRuntimeError());
		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(1);

		setErrorReportRuntimeErrorReporter(undefined);
		await captureRuntimeErrorReport(createRuntimeError());

		expect(getRuntimeErrorBreadcrumbs()).toHaveLength(2);
	});

	it("сразу разрешает повторный capture после отклонения предыдущего", async () => {
		const input = createDeduplicationInput();
		const failure = new Error("capture failed");
		const failedCapture = coalesceRuntimeErrorReportCapture(input, () => Promise.reject(failure));

		await expect(failedCapture).rejects.toBe(failure);

		const retryFactory = vi.fn(() => Promise.resolve(undefined));
		const retryCapture = coalesceRuntimeErrorReportCapture(input, retryFactory);

		expect(retryFactory).toHaveBeenCalledOnce();
		await expect(retryCapture).resolves.toBeUndefined();
	});

	it("не позволяет старому отклонению удалить новую запись после lifecycle-сброса", async () => {
		const input = createDeduplicationInput();
		let rejectOldCapture: (reason: Error) => void = () => undefined;
		const oldCapturePromise = new Promise<undefined>((_resolve, reject) => {
			rejectOldCapture = reject;
		});
		const oldCapture = coalesceRuntimeErrorReportCapture(input, () => oldCapturePromise);
		const handledOldCapture = oldCapture.catch(() => undefined);

		clearRuntimeErrorReportDeduplication();

		let resolveNewCapture: (value: undefined) => void = () => undefined;
		const newCapturePromise = new Promise<undefined>((resolve) => {
			resolveNewCapture = resolve;
		});
		const newCapture = coalesceRuntimeErrorReportCapture(input, () => newCapturePromise);

		rejectOldCapture(new Error("old capture failed"));
		await handledOldCapture;

		const unexpectedFactory = vi.fn(() => Promise.resolve(undefined));
		const repeatedNewCapture = coalesceRuntimeErrorReportCapture(input, unexpectedFactory);

		expect(repeatedNewCapture).toBe(newCapture);
		expect(unexpectedFactory).not.toHaveBeenCalled();

		resolveNewCapture(undefined);
		await newCapture;
	});

	it("ограничивает число сохранённых fingerprint", () => {
		let firstCapture: ReturnType<typeof coalesceRuntimeErrorReportCapture> | undefined;

		for (let index = 0; index <= 100; index += 1) {
			const capture = coalesceRuntimeErrorReportCapture(
				{
					category: "runtime",
					source: "runtime",
					error: {
						name: "Error",
						message: "test",
						stackTrace: `Error: test\n    at capture-${index}.tsx:1:1`
					},
					pathname: "/arm/app/checking-wagons"
				},
				() => Promise.resolve(undefined)
			);

			if (index === 0) {
				firstCapture = capture;
			}
		}

		const repeatedFirstCapture = coalesceRuntimeErrorReportCapture(
			{
				category: "runtime",
				source: "runtime",
				error: {
					name: "Error",
					message: "test",
					stackTrace: "Error: test\n    at capture-0.tsx:1:1"
				},
				pathname: "/arm/app/checking-wagons"
			},
			() => Promise.resolve(undefined)
		);

		expect(repeatedFirstCapture).not.toBe(firstCapture);
	});
});
