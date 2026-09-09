import { afterEach, describe, expect, it } from "vitest";

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
