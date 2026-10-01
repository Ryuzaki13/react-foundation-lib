import { afterEach, describe, expect, it } from "vitest";

import { setErrorReportCaptureOptions } from "./captureOptions";
import {
	ERROR_REPORT_PAYLOAD_MAX_BYTES,
	ERROR_REPORT_PAYLOAD_VERSION,
	getErrorReportPayloadSize,
	limitErrorReportPayload
} from "./payload";
import { setErrorReportSanitizer } from "./safeValue";
import { parseErrorReportDraft, parseErrorReportDrafts, parseErrorReportPayload } from "./schema";

import type { ErrorReportPayload, ErrorReportSafeValue } from "./types";

const REPORT_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const CREATED_UTC = "2026-09-09T12:00:00.000Z";

function createPayload(overrides: Partial<ErrorReportPayload> = {}): ErrorReportPayload {
	return {
		payloadVersion: ERROR_REPORT_PAYLOAD_VERSION,
		application: "ru.education-system",
		reportId: REPORT_ID,
		sessionId: SESSION_ID,
		createdUtc: CREATED_UTC,
		category: "runtime",
		source: "window-error",
		error: {
			name: "Error",
			message: "Не удалось открыть экран",
			stackTrace: "Error: Не удалось открыть экран\n    at route.tsx:10:2"
		},
		environment: {
			mode: "production",
			buildId: "0123456789abcdef0123456789abcdef01234567"
		},
		location: {
			pathname: "/workspace/students?token=secret#profile",
			origin: "https://education.ktk-45.ru"
		},
		breadcrumbs: [],
		...overrides
	};
}

afterEach(() => {
	setErrorReportSanitizer(undefined);
	setErrorReportCaptureOptions(undefined);
});

describe("versioned error-report payload", () => {
	it("парсит текущую версию и отклоняет unversioned/future payload", () => {
		const payload = limitErrorReportPayload(createPayload());

		expect(parseErrorReportPayload(payload)).toEqual(payload);
		expect(parseErrorReportPayload({ ...payload, payloadVersion: undefined })).toBeUndefined();
		expect(parseErrorReportPayload({ ...payload, payloadVersion: 2 })).toBeUndefined();
	});

	it("без исключения отклоняет циклический runtime input", () => {
		const payload = createPayload() as unknown as Record<string, unknown>;
		const cyclicContext: Record<string, unknown> = {};
		cyclicContext.self = cyclicContext;
		payload.context = cyclicContext;

		expect(parseErrorReportPayload(payload)).toBeUndefined();
	});

	it("проверяет совпадение identity draft и payload", () => {
		const payload = limitErrorReportPayload(createPayload());
		const draft = {
			reportId: REPORT_ID,
			sessionId: SESSION_ID,
			createdUtc: CREATED_UTC,
			category: "runtime" as const,
			status: "pending" as const,
			payload
		};

		expect(parseErrorReportDraft(draft)).toEqual(draft);
		expect(parseErrorReportDraft({ ...draft, reportId: "00000000-0000-4000-8000-000000000003" })).toBeUndefined();
		expect(parseErrorReportDrafts([draft, { broken: true }])).toEqual([draft]);
	});

	it("применяет app sanitizer до финального payload и очищает pathname", () => {
		setErrorReportSanitizer((value, context) => {
			if ((context.scope === "error-message" || context.scope === "stack-trace") && typeof value === "string") {
				return value.replaceAll("Иванов Иван Иванович", "[REDACTED_PERSON]");
			}
			if (context.scope !== "context" || !value || Array.isArray(value) || typeof value !== "object") return value;
			return "operation" in value ? { operation: value.operation } : undefined;
		});

		const payload = limitErrorReportPayload(
			createPayload({
				error: {
					name: "Error",
					message: "Не удалось открыть карточку Иванов Иван Иванович",
					stackTrace: "Error: Иванов Иван Иванович\n    at route.tsx:10:2"
				},
				context: {
					operation: "student.open",
					fullName: "Иванов Иван Иванович",
					phone: "+7 900 000-00-00"
				}
			})
		);

		expect(payload.context).toEqual({ operation: "student.open" });
		expect(payload.error.message).toContain("[REDACTED_PERSON]");
		expect(payload.location?.pathname).toBe("/workspace/students");
		expect(JSON.stringify(payload)).not.toContain("Иванов Иван Иванович");
	});

	it("verbatim-режим сохраняет message, URL и bounded preview", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim", dataPreviewBytes: { query: 2_048 } });
		const payload = limitErrorReportPayload(
			createPayload({
				error: { name: "Error", message: "Bearer example-token user@example.test" },
				location: {
					pathname: "/workspace/students?person=42#profile",
					origin: "https://education.example.test",
					search: "?person=42",
					hash: "#profile"
				},
				query: {
					queryHash: "original-hash",
					queryKey: ["students", { url: "/api/students?person=42" }],
					dataPreview: { json: JSON.stringify({ row: { id: 42 } }), truncated: false }
				}
			})
		);

		expect(payload.error.message).toBe("Bearer example-token user@example.test");
		expect(payload.location).toMatchObject({ search: "?person=42", hash: "#profile" });
		expect(payload.location?.pathname).toBe("/workspace/students?person=42#profile");
		expect(payload.query?.queryKey).toEqual(["students", { url: "/api/students?person=42" }]);
		expect(payload.query?.dataPreview).toEqual({ json: '{"row":{"id":42}}', truncated: false });
		expect(parseErrorReportPayload(payload)).toEqual(payload);
	});

	it("verbatim-режим проводит HTML sample transport context до payload", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim" });
		const payload = limitErrorReportPayload(
			createPayload({
				context: {
					requestUrl: "/sap/odata/Orders?$filter=Customer eq '42'",
					html: { length: 5_000, sample: "<html><title>Ошибка заказа 42</title></html>", truncated: true }
				}
			})
		);

		expect(payload.context).toMatchObject({
			requestUrl: "/sap/odata/Orders?$filter=Customer eq '42'",
			html: { length: 5_000, sample: "<html><title>Ошибка заказа 42</title></html>", truncated: true }
		});
		expect(parseErrorReportPayload(payload)).toEqual(payload);
	});

	it("парсит явные маркеры усечения длинного queryKey и context", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim" });
		const payload = limitErrorReportPayload(
			createPayload({
				query: {
					queryHash: "original-hash",
					queryKey: Array.from({ length: 25 }, (_, index) => index)
				},
				context: Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`field-${index}`, index]))
			})
		);

		expect(payload.query?.queryKey).toHaveLength(20);
		expect((payload.query?.queryKey as Array<unknown>).at(-1)).toEqual({ type: "truncated", omittedItems: 6 });
		expect(payload.context?.["$truncated"]).toEqual({ type: "truncated", omittedKeys: 6 });
		expect(parseErrorReportPayload(payload)).toEqual(payload);
	});

	it("при переполнении сначала сокращает data previews и сохраняет queryClient", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim", dataPreviewBytes: { query: 16 * 1_024 } });
		const dataPreview = { json: JSON.stringify({ id: 42, body: "x".repeat(10_000) }), truncated: false };
		const payload = limitErrorReportPayload(
			createPayload({
				queryClient: {
					queries: Array.from({ length: 40 }, (_, index) => ({
						queryHash: `original-hash-${index}`,
						queryKey: ["orders", index],
						dataPreview
					})),
					mutations: [],
					omittedQueries: 5,
					omittedMutations: 2
				}
			})
		);

		expect(getErrorReportPayloadSize(payload)).toBeLessThanOrEqual(ERROR_REPORT_PAYLOAD_MAX_BYTES);
		expect(payload.queryClient?.queries).toHaveLength(40);
		expect(payload.queryClient?.omittedQueries).toBe(5);
		expect(payload.queryClient?.omittedMutations).toBe(2);
		expect(payload.queryClient?.queries.every((query) => query.dataPreview?.truncated)).toBe(true);
		expect(payload.truncation?.droppedSections).toEqual([]);
		expect(parseErrorReportPayload(payload)).toEqual(payload);
	});

	it("при 40 больших ключах явно отмечает удалённые старые query и соблюдает общий предел", () => {
		setErrorReportCaptureOptions({ valuePolicy: "verbatim" });
		const payload = limitErrorReportPayload(
			createPayload({
				queryClient: {
					queries: Array.from({ length: 40 }, (_, index) => ({
						queryHash: `original-hash-${index}`,
						queryKey: ["orders", `${"x".repeat(9_000)}-${index}`],
						meta: {
							first: "a".repeat(4_096),
							second: "b".repeat(4_096),
							third: "c".repeat(4_096)
						}
					})),
					mutations: []
				}
			})
		);

		expect(getErrorReportPayloadSize(payload)).toBeLessThanOrEqual(ERROR_REPORT_PAYLOAD_MAX_BYTES);
		expect(payload.truncation?.droppedSections).toContain("queryClient.queries:oldest");
		expect(payload.queryClient?.queries).toHaveLength(10);
		expect(payload.queryClient?.omittedQueries).toBe(30);
		expect(payload.queryClient?.queries[0].queryKey).toContainEqual(expect.stringContaining("[TRUNCATED:"));
		expect(parseErrorReportPayload(payload)).toEqual(payload);
	});

	it("детерминированно уменьшает oversized payload и добавляет marker", () => {
		const largeContext = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field-${index}`, "x".repeat(4_096)])) as Record<
			string,
			ErrorReportSafeValue
		>;
		const oversized = createPayload({
			error: {
				name: "Error",
				message: "x".repeat(4_096),
				stackTrace: "x".repeat(64 * 1_024)
			},
			react: { componentStack: "x".repeat(32 * 1_024) },
			context: largeContext
		});

		const first = limitErrorReportPayload(oversized);
		const second = limitErrorReportPayload(oversized);

		expect(getErrorReportPayloadSize(first)).toBeLessThanOrEqual(ERROR_REPORT_PAYLOAD_MAX_BYTES);
		expect(first.truncation).toMatchObject({
			reason: "payload-size",
			limitBytes: ERROR_REPORT_PAYLOAD_MAX_BYTES
		});
		expect(first.truncation?.droppedSections).toContain("context");
		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
		expect(parseErrorReportPayload(first)).toEqual(first);
	});
});
