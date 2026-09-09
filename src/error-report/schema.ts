import { z } from "zod";

import { ERROR_REPORT_PAYLOAD_MAX_BYTES, getErrorReportPayloadSize } from "./payload";
import { getUtf8TextSize } from "./safeValue";

import type { ErrorReportDraft, ErrorReportPayload, ErrorReportSafeValue } from "./types";

const safeValueSchema: z.ZodType<ErrorReportSafeValue> = z.lazy(() =>
	z.union([
		z.string().max(4_096),
		z.number().finite(),
		z.boolean(),
		z.null(),
		z.array(safeValueSchema).max(20),
		z.record(z.string(), safeValueSchema).refine((value) => Object.keys(value).length <= 40)
	])
);

const safeRecordSchema = z.record(z.string(), safeValueSchema).refine((value) => Object.keys(value).length <= 40);
const errorInfoSchema = z
	.object({
		name: z.string().min(1).max(256),
		message: z.string().min(1).max(4_096),
		code: z.string().max(128).optional(),
		stackTrace: z
			.string()
			.refine((value) => getUtf8TextSize(value) <= 64 * 1_024)
			.optional(),
		httpStatus: z.number().finite().optional()
	})
	.strict();
const breadcrumbSchema = z
	.object({
		utc: z.string().min(1).max(64),
		type: z.enum(["route", "click", "visibility", "query-error", "mutation-error", "runtime-error"]),
		routeId: z.string().max(512).optional(),
		appId: z.string().max(128).optional(),
		viewId: z.string().max(128).optional(),
		target: z.string().max(2_048).optional(),
		detail: safeRecordSchema.optional()
	})
	.strict();
const queryDiagnosticsSchema = z
	.object({
		queryHash: z.string().max(512),
		queryKey: safeValueSchema,
		status: z.string().max(64).optional(),
		fetchStatus: z.string().max(64).optional(),
		dataUpdatedAt: z.number().finite().optional(),
		errorUpdatedAt: z.number().finite().optional(),
		failureCount: z.number().finite().optional(),
		isInvalidated: z.boolean().optional(),
		observersCount: z.number().finite().optional(),
		meta: safeRecordSchema.optional(),
		dataShape: safeValueSchema.optional(),
		error: errorInfoSchema.optional()
	})
	.strict();
const mutationDiagnosticsSchema = z
	.object({
		mutationKey: safeValueSchema.optional(),
		status: z.string().max(64).optional(),
		failureCount: z.number().finite().optional(),
		submittedAt: z.number().finite().optional(),
		meta: safeRecordSchema.optional(),
		error: errorInfoSchema.optional()
	})
	.strict();
const persistedQueryDiagnosticsSchema = z
	.object({
		buster: z.string().max(512).optional(),
		queryHash: z.string().max(512).optional(),
		queryKey: safeValueSchema.optional(),
		status: z.string().max(64).optional(),
		fetchStatus: z.string().max(64).optional(),
		dataUpdatedAt: z.number().finite().optional(),
		errorUpdatedAt: z.number().finite().optional(),
		failureCount: z.number().finite().optional(),
		error: errorInfoSchema.optional()
	})
	.strict();

const errorReportPayloadSchema: z.ZodType<ErrorReportPayload> = z
	.object({
		payloadVersion: z.literal(1),
		application: z.string().min(1).max(128),
		reportId: z.string().uuid(),
		sessionId: z.string().uuid(),
		createdUtc: z.string().min(1).max(64),
		category: z.enum(["query", "mutation", "runtime", "react"]),
		source: z.string().min(1).max(256),
		error: errorInfoSchema,
		environment: z
			.object({
				mode: z.enum(["development", "production"]),
				buildId: z.string().max(128).optional()
			})
			.strict(),
		client: z
			.object({
				userAgent: z.string().max(4_096).optional(),
				language: z.string().max(128).optional(),
				timeZone: z.string().max(128).optional()
			})
			.strict()
			.optional(),
		location: z
			.object({
				pathname: z.string().max(2_048),
				origin: z.string().max(2_048).optional()
			})
			.strict()
			.optional(),
		viewport: z
			.object({
				width: z.number().finite(),
				height: z.number().finite(),
				devicePixelRatio: z.number().finite().optional()
			})
			.strict()
			.optional(),
		react: z
			.object({
				componentStack: z
					.string()
					.refine((value) => getUtf8TextSize(value) <= 32 * 1_024)
					.optional()
			})
			.strict()
			.optional(),
		query: queryDiagnosticsSchema.optional(),
		mutation: mutationDiagnosticsSchema.optional(),
		queryClient: z
			.object({
				queries: z.array(queryDiagnosticsSchema).max(40),
				mutations: z.array(mutationDiagnosticsSchema).max(40)
			})
			.strict()
			.optional(),
		persistedQueries: z.array(persistedQueryDiagnosticsSchema).max(40).optional(),
		breadcrumbs: z.array(breadcrumbSchema).max(80),
		context: safeRecordSchema.optional(),
		truncation: z
			.object({
				reason: z.literal("payload-size"),
				limitBytes: z.literal(ERROR_REPORT_PAYLOAD_MAX_BYTES),
				originalBytes: z.number().int().positive(),
				droppedSections: z.array(z.string().max(128)).max(32)
			})
			.strict()
			.optional()
	})
	.strict()
	.refine((payload) => getErrorReportPayloadSize(payload) <= ERROR_REPORT_PAYLOAD_MAX_BYTES);

const errorReportDraftSchema: z.ZodType<ErrorReportDraft> = z
	.object({
		reportId: z.string().uuid(),
		sessionId: z.string().uuid(),
		createdUtc: z.string().min(1).max(64),
		category: z.enum(["query", "mutation", "runtime", "react"]),
		status: z.enum(["pending", "sending", "sent", "failed"]),
		sentUtc: z.string().min(1).max(64).optional(),
		failedReason: z.string().max(4_096).optional(),
		payload: errorReportPayloadSchema
	})
	.strict()
	.superRefine((draft, context) => {
		const matchingIdentity =
			draft.reportId === draft.payload.reportId &&
			draft.sessionId === draft.payload.sessionId &&
			draft.createdUtc === draft.payload.createdUtc &&
			draft.category === draft.payload.category;

		if (!matchingIdentity) {
			context.addIssue({
				code: "custom",
				message: "Draft identity должна совпадать с payload identity."
			});
		}
	});

function isSerializedInputWithinLimit(value: unknown, maxBytes: number) {
	try {
		return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes;
	} catch {
		return false;
	}
}

/**
 * Парсит только текущую versioned форму. Unversioned и будущие payload
 * отклоняются явно, чтобы storage/delivery не угадывали форму контракта.
 */
export function parseErrorReportPayload(value: unknown) {
	if (!isSerializedInputWithinLimit(value, ERROR_REPORT_PAYLOAD_MAX_BYTES)) return undefined;

	try {
		const result = errorReportPayloadSchema.safeParse(value);
		return result.success ? result.data : undefined;
	} catch {
		return undefined;
	}
}

/** Проверяет одну draft-запись, включая совпадение её identity с payload. */
export function parseErrorReportDraft(value: unknown) {
	if (!isSerializedInputWithinLimit(value, ERROR_REPORT_PAYLOAD_MAX_BYTES + 16 * 1_024)) return undefined;

	try {
		const result = errorReportDraftSchema.safeParse(value);
		return result.success ? result.data : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Восстанавливает все валидные drafts независимо: одна повреждённая запись не
 * должна уничтожить остальные элементы browser storage.
 */
export function parseErrorReportDrafts(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((draft) => {
		const parsed = parseErrorReportDraft(draft);
		return parsed ? [parsed] : [];
	});
}
