import { indexedDB } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import { createErrorReportQueue } from "./queue";
import { ERROR_REPORT_QUEUE_LEASE_MS, ERROR_REPORT_QUEUE_MAX_ITEMS, ERROR_REPORT_QUEUE_TTL_MS } from "./queueContract";
import { parseErrorReportQueueRecord } from "./queueRecord";
import { type ErrorReportPayload } from "./types";

const NOW = new Date("2026-09-09T06:00:00.000Z");

function reportId(index: number) {
	return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function createPayload(index = 1): ErrorReportPayload {
	const id = reportId(index);
	return {
		payloadVersion: 1,
		application: "test-application",
		reportId: id,
		sessionId: "10000000-0000-4000-8000-000000000001",
		createdUtc: NOW.toISOString(),
		category: "runtime",
		source: "queue-test",
		error: { name: "Error", message: `Ошибка ${index}` },
		environment: { mode: "production", buildId: "build-test" },
		breadcrumbs: []
	};
}

function createQueue(dbName = `error-report-queue-${crypto.randomUUID()}`) {
	const queue = createErrorReportQueue({ indexedDB, dbName });
	if (!queue) throw new Error("IndexedDB queue не создана в тесте");
	return queue;
}

describe("createErrorReportQueue", () => {
	it("возвращает undefined без IndexedDB", () => {
		expect(createErrorReportQueue({ indexedDB: undefined })).toBeUndefined();
	});

	it("сохраняет запись после повторного открытия и не дублирует reportId", async () => {
		const dbName = `error-report-reopen-${crypto.randomUUID()}`;
		const firstQueue = createQueue(dbName);
		const payload = createPayload();

		await expect(firstQueue.enqueue(payload, NOW)).resolves.toEqual({ status: "enqueued" });
		await expect(firstQueue.enqueue(payload, NOW)).resolves.toEqual({ status: "duplicate" });

		const reopenedQueue = createQueue(dbName);
		await expect(reopenedQueue.getRecords(NOW)).resolves.toMatchObject([{ reportId: payload.reportId, attemptCount: 0 }]);
	});

	it("выдаёт один атомарный lease двум вкладкам и восстанавливает его после crash timeout", async () => {
		const dbName = `error-report-race-${crypto.randomUUID()}`;
		const firstTab = createQueue(dbName);
		const secondTab = createQueue(dbName);
		await firstTab.enqueue(createPayload(), NOW);

		const [firstLease, secondLease] = await Promise.all([
			firstTab.leaseNext({ ownerId: "tab-1", now: NOW }),
			secondTab.leaseNext({ ownerId: "tab-2", now: NOW })
		]);

		expect([firstLease, secondLease].filter(Boolean)).toHaveLength(1);
		const leased = firstLease ?? secondLease;
		expect(leased?.attemptCount).toBe(1);
		await expect(
			secondTab.leaseNext({ ownerId: "recovery-tab", now: new Date(NOW.getTime() + ERROR_REPORT_QUEUE_LEASE_MS + 1) })
		).resolves.toMatchObject({ reportId: createPayload().reportId, attemptCount: 2, lease: { ownerId: "recovery-tab" } });
	});

	it("защищает acknowledge и retry от владельца устаревшего lease", async () => {
		const queue = createQueue();
		const payload = createPayload();
		await queue.enqueue(payload, NOW);
		await queue.leaseNext({ ownerId: "tab-1", now: NOW });

		await expect(queue.acknowledge(payload.reportId, "tab-2")).resolves.toBe("lease-mismatch");
		await expect(
			queue.reschedule(payload.reportId, "tab-1", {
				nextAttemptUtc: new Date(NOW.getTime() + 5_000).toISOString(),
				failure: { utc: NOW.toISOString(), kind: "network" }
			})
		).resolves.toBe("updated");
		await expect(queue.leaseNext({ ownerId: "tab-2", now: new Date(NOW.getTime() + 4_999) })).resolves.toBeUndefined();
		await expect(queue.getNextWakeUtc(NOW)).resolves.toBe(new Date(NOW.getTime() + 5_000).toISOString());
		await expect(queue.leaseNext({ ownerId: "tab-2", now: new Date(NOW.getTime() + 5_000) })).resolves.toMatchObject({
			attemptCount: 2,
			lastFailure: { kind: "network" }
		});
		await expect(queue.acknowledge(payload.reportId, "tab-2")).resolves.toBe("updated");
		await expect(queue.getRecords(NOW)).resolves.toEqual([]);
	});

	it("удаляет записи после семидневного TTL", async () => {
		const queue = createQueue();
		await queue.enqueue(createPayload(), NOW);

		await expect(queue.getRecords(new Date(NOW.getTime() + ERROR_REPORT_QUEUE_TTL_MS))).resolves.toEqual([]);
	});

	it("при переполнении вытесняет самый старый свободный отчёт", async () => {
		const queue = createQueue();
		for (let index = 1; index <= ERROR_REPORT_QUEUE_MAX_ITEMS; index += 1) {
			await queue.enqueue(createPayload(index), new Date(NOW.getTime() + index));
		}

		await expect(queue.enqueue(createPayload(51), new Date(NOW.getTime() + 51))).resolves.toEqual({
			status: "enqueued",
			evictedReportId: reportId(1)
		});
		const records = await queue.getRecords(NOW);
		expect(records).toHaveLength(ERROR_REPORT_QUEUE_MAX_ITEMS);
		expect(records.some((record) => record.reportId === reportId(1))).toBe(false);
		expect(records.some((record) => record.reportId === reportId(51))).toBe(true);
	});

	it("не вытесняет активные leases при полном заполнении", async () => {
		const queue = createQueue();
		for (let index = 1; index <= ERROR_REPORT_QUEUE_MAX_ITEMS; index += 1) {
			await queue.enqueue(createPayload(index), NOW);
		}
		for (let index = 1; index <= ERROR_REPORT_QUEUE_MAX_ITEMS; index += 1) {
			await queue.leaseNext({ ownerId: `tab-${index}`, now: NOW });
		}

		await expect(queue.enqueue(createPayload(51), NOW)).resolves.toEqual({ status: "capacity-exceeded" });
	});

	it("отклоняет повреждённый payload до записи", async () => {
		const queue = createQueue();
		const invalidPayload = { ...createPayload(), payloadVersion: 2 } as unknown as ErrorReportPayload;

		await expect(queue.enqueue(invalidPayload, NOW)).resolves.toEqual({ status: "invalid-payload" });
		await expect(queue.getRecords(NOW)).resolves.toEqual([]);
	});

	it("не поглощает quota/storage failure, чтобы coordinator мог применить recovery policy", async () => {
		const storageError = new DOMException("Quota exceeded", "QuotaExceededError");
		const storage = {
			getItem: vi.fn(async () => undefined),
			updateItem: vi.fn(async () => {
				throw storageError;
			})
		};
		const queue = createErrorReportQueue({ storage });

		await expect(queue?.enqueue(createPayload(), NOW)).rejects.toBe(storageError);
	});
});

describe("parseErrorReportQueueRecord", () => {
	it("не принимает future queue schema", () => {
		expect(
			parseErrorReportQueueRecord({
				queueVersion: 2,
				reportId: createPayload().reportId,
				payload: createPayload()
			})
		).toBeUndefined();
	});
});
