import { z } from "zod";

import {
	ERROR_REPORT_SAFE_STRING_MAX_LENGTH,
	ERROR_REPORT_SAFE_ARRAY_MAX_ITEMS,
	ERROR_REPORT_SAFE_OBJECT_MAX_KEYS,
	ERROR_REPORT_DATA_PREVIEW_MAX_BYTES,
	ERROR_REPORT_ERROR_NAME_MAX_LENGTH,
	ERROR_REPORT_ERROR_CODE_MAX_LENGTH,
	ERROR_REPORT_UTC_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_ROUTE_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_APP_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_VIEW_MAX_LENGTH,
	ERROR_REPORT_BREADCRUMB_TARGET_MAX_LENGTH,
	ERROR_REPORT_QUERY_HASH_MAX_LENGTH,
	ERROR_REPORT_PERSISTENCE_BUSTER_MAX_LENGTH,
	ERROR_REPORT_APPLICATION_MAX_LENGTH,
	ERROR_REPORT_SOURCE_MAX_LENGTH,
	ERROR_REPORT_BUILD_ID_MAX_LENGTH,
	ERROR_REPORT_LANGUAGE_MAX_LENGTH,
	ERROR_REPORT_TIME_ZONE_MAX_LENGTH,
	ERROR_REPORT_LOCATION_MAX_LENGTH,
	ERROR_REPORT_COMPONENT_STACK_MAX_BYTES,
	ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_PERSISTED_DIAGNOSTICS_MAX_ITEMS,
	ERROR_REPORT_BREADCRUMBS_MAX_ITEMS
} from "./errorReportCaptureLimits";
import {
	ERROR_REPORT_BREADCRUMB_ROUTE,
	ERROR_REPORT_BREADCRUMB_CLICK,
	ERROR_REPORT_BREADCRUMB_VISIBILITY,
	ERROR_REPORT_BREADCRUMB_QUERY_ERROR,
	ERROR_REPORT_BREADCRUMB_MUTATION_ERROR,
	ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR,
	ERROR_REPORT_CATEGORY_QUERY,
	ERROR_REPORT_CATEGORY_MUTATION,
	ERROR_REPORT_CATEGORY_RUNTIME,
	ERROR_REPORT_CATEGORY_REACT,
	ERROR_REPORT_MODE_DEVELOPMENT,
	ERROR_REPORT_MODE_PRODUCTION,
	ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE,
	ERROR_REPORT_STATUS_PENDING,
	ERROR_REPORT_STATUS_SENDING,
	ERROR_REPORT_STATUS_SENT,
	ERROR_REPORT_STATUS_FAILED
} from "./errorReportContractConstants";
import {
	ERROR_REPORT_PAYLOAD_MAX_BYTES,
	ERROR_REPORT_PAYLOAD_VERSION,
	ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES,
	ERROR_REPORT_STACK_TRACE_MAX_BYTES,
	getErrorReportPayloadSize
} from "./payload";
import { getUtf8TextSize } from "./safeValue";

import type { ErrorReportDraft, ErrorReportPayload, ErrorReportSafeValue } from "./types";

const ERROR_REPORT_QUERY_STATUS_MAX_LENGTH = 64;
const ERROR_REPORT_QUERY_FETCH_STATUS_MAX_LENGTH = 64;
const ERROR_REPORT_MUTATION_STATUS_MAX_LENGTH = 64;
const USER_AGENT_MAX_LENGTH = 4_096;
const FAILED_REASON_MAX_LENGTH = 4_096;
const DROPPED_SECTION_LABEL_MAX_LENGTH = 128;
const DROPPED_SECTIONS_MAX_ITEMS = 32;
const DRAFT_METADATA_MAX_BYTES = 16 * 1_024;

const safeValueSchema: z.ZodType<ErrorReportSafeValue> = z.lazy(() =>
	z.union([
		z.string().max(ERROR_REPORT_SAFE_STRING_MAX_LENGTH),
		z.number().finite(),
		z.boolean(),
		z.null(),
		z.array(safeValueSchema).max(ERROR_REPORT_SAFE_ARRAY_MAX_ITEMS),
		z.record(z.string(), safeValueSchema).refine((value) => Object.keys(value).length <= ERROR_REPORT_SAFE_OBJECT_MAX_KEYS)
	])
);

const safeRecordSchema = z
	.record(z.string(), safeValueSchema)
	.refine((value) => Object.keys(value).length <= ERROR_REPORT_SAFE_OBJECT_MAX_KEYS);
const dataPreviewSchema = z
	.object({
		json: z.string().refine((value) => {
			if (getUtf8TextSize(value) > ERROR_REPORT_DATA_PREVIEW_MAX_BYTES) return false;
			try {
				JSON.parse(value);
				return true;
			} catch {
				return false;
			}
		}),
		truncated: z.boolean()
	})
	.strict();
const errorInfoSchema = z
	.object({
		name: z.string().min(1).max(ERROR_REPORT_ERROR_NAME_MAX_LENGTH),
		message: z
			.string()
			.min(1)
			.max(ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES)
			.refine((value) => getUtf8TextSize(value) <= ERROR_REPORT_VERBATIM_MESSAGE_MAX_BYTES),
		code: z.string().max(ERROR_REPORT_ERROR_CODE_MAX_LENGTH).optional(),
		stackTrace: z
			.string()
			.refine((value) => getUtf8TextSize(value) <= ERROR_REPORT_STACK_TRACE_MAX_BYTES)
			.optional(),
		httpStatus: z.number().finite().optional()
	})
	.strict();
const breadcrumbSchema = z
	.object({
		utc: z.string().min(1).max(ERROR_REPORT_UTC_MAX_LENGTH),
		type: z.enum([
			ERROR_REPORT_BREADCRUMB_ROUTE,
			ERROR_REPORT_BREADCRUMB_CLICK,
			ERROR_REPORT_BREADCRUMB_VISIBILITY,
			ERROR_REPORT_BREADCRUMB_QUERY_ERROR,
			ERROR_REPORT_BREADCRUMB_MUTATION_ERROR,
			ERROR_REPORT_BREADCRUMB_RUNTIME_ERROR
		]),
		routeId: z.string().max(ERROR_REPORT_BREADCRUMB_ROUTE_MAX_LENGTH).optional(),
		appId: z.string().max(ERROR_REPORT_BREADCRUMB_APP_MAX_LENGTH).optional(),
		viewId: z.string().max(ERROR_REPORT_BREADCRUMB_VIEW_MAX_LENGTH).optional(),
		target: z.string().max(ERROR_REPORT_BREADCRUMB_TARGET_MAX_LENGTH).optional(),
		detail: safeRecordSchema.optional()
	})
	.strict();
const queryDiagnosticsSchema = z
	.object({
		queryHash: z.string().max(ERROR_REPORT_QUERY_HASH_MAX_LENGTH),
		queryKey: safeValueSchema,
		status: z.string().max(ERROR_REPORT_QUERY_STATUS_MAX_LENGTH).optional(),
		fetchStatus: z.string().max(ERROR_REPORT_QUERY_FETCH_STATUS_MAX_LENGTH).optional(),
		dataUpdatedAt: z.number().finite().optional(),
		errorUpdatedAt: z.number().finite().optional(),
		failureCount: z.number().finite().optional(),
		isInvalidated: z.boolean().optional(),
		observersCount: z.number().finite().optional(),
		meta: safeRecordSchema.optional(),
		dataShape: safeValueSchema.optional(),
		dataPreview: dataPreviewSchema.optional(),
		error: errorInfoSchema.optional()
	})
	.strict();
const mutationDiagnosticsSchema = z
	.object({
		mutationKey: safeValueSchema.optional(),
		status: z.string().max(ERROR_REPORT_MUTATION_STATUS_MAX_LENGTH).optional(),
		failureCount: z.number().finite().optional(),
		submittedAt: z.number().finite().optional(),
		meta: safeRecordSchema.optional(),
		variablesPreview: dataPreviewSchema.optional(),
		error: errorInfoSchema.optional()
	})
	.strict();
const persistedQueryDiagnosticsSchema = z
	.object({
		buster: z.string().max(ERROR_REPORT_PERSISTENCE_BUSTER_MAX_LENGTH).optional(),
		queryHash: z.string().max(ERROR_REPORT_QUERY_HASH_MAX_LENGTH).optional(),
		queryKey: safeValueSchema.optional(),
		status: z.string().max(ERROR_REPORT_QUERY_STATUS_MAX_LENGTH).optional(),
		fetchStatus: z.string().max(ERROR_REPORT_QUERY_FETCH_STATUS_MAX_LENGTH).optional(),
		dataUpdatedAt: z.number().finite().optional(),
		errorUpdatedAt: z.number().finite().optional(),
		failureCount: z.number().finite().optional(),
		dataPreview: dataPreviewSchema.optional(),
		error: errorInfoSchema.optional()
	})
	.strict();

const errorReportPayloadSchema: z.ZodType<ErrorReportPayload> = z
	.object({
		payloadVersion: z.literal(ERROR_REPORT_PAYLOAD_VERSION),
		application: z.string().min(1).max(ERROR_REPORT_APPLICATION_MAX_LENGTH),
		reportId: z.string().uuid(),
		sessionId: z.string().uuid(),
		createdUtc: z.string().min(1).max(ERROR_REPORT_UTC_MAX_LENGTH),
		category: z.enum([
			ERROR_REPORT_CATEGORY_QUERY,
			ERROR_REPORT_CATEGORY_MUTATION,
			ERROR_REPORT_CATEGORY_RUNTIME,
			ERROR_REPORT_CATEGORY_REACT
		]),
		source: z.string().min(1).max(ERROR_REPORT_SOURCE_MAX_LENGTH),
		error: errorInfoSchema,
		environment: z
			.object({
				mode: z.enum([ERROR_REPORT_MODE_DEVELOPMENT, ERROR_REPORT_MODE_PRODUCTION]),
				buildId: z.string().max(ERROR_REPORT_BUILD_ID_MAX_LENGTH).optional()
			})
			.strict(),
		client: z
			.object({
				userAgent: z.string().max(USER_AGENT_MAX_LENGTH).optional(),
				language: z.string().max(ERROR_REPORT_LANGUAGE_MAX_LENGTH).optional(),
				timeZone: z.string().max(ERROR_REPORT_TIME_ZONE_MAX_LENGTH).optional()
			})
			.strict()
			.optional(),
		location: z
			.object({
				pathname: z.string().max(ERROR_REPORT_LOCATION_MAX_LENGTH),
				origin: z.string().max(ERROR_REPORT_LOCATION_MAX_LENGTH).optional(),
				search: z.string().max(ERROR_REPORT_LOCATION_MAX_LENGTH).optional(),
				hash: z.string().max(ERROR_REPORT_LOCATION_MAX_LENGTH).optional()
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
					.refine((value) => getUtf8TextSize(value) <= ERROR_REPORT_COMPONENT_STACK_MAX_BYTES)
					.optional()
			})
			.strict()
			.optional(),
		query: queryDiagnosticsSchema.optional(),
		mutation: mutationDiagnosticsSchema.optional(),
		queryClient: z
			.object({
				queries: z.array(queryDiagnosticsSchema).max(ERROR_REPORT_QUERY_DIAGNOSTICS_MAX_ITEMS),
				mutations: z.array(mutationDiagnosticsSchema).max(ERROR_REPORT_MUTATION_DIAGNOSTICS_MAX_ITEMS),
				omittedQueries: z.number().int().nonnegative().optional(),
				omittedMutations: z.number().int().nonnegative().optional()
			})
			.strict()
			.optional(),
		persistedQueries: z.array(persistedQueryDiagnosticsSchema).max(ERROR_REPORT_PERSISTED_DIAGNOSTICS_MAX_ITEMS).optional(),
		breadcrumbs: z.array(breadcrumbSchema).max(ERROR_REPORT_BREADCRUMBS_MAX_ITEMS),
		context: safeRecordSchema.optional(),
		truncation: z
			.object({
				reason: z.literal(ERROR_REPORT_TRUNCATION_PAYLOAD_SIZE),
				limitBytes: z.literal(ERROR_REPORT_PAYLOAD_MAX_BYTES),
				originalBytes: z.number().int().positive(),
				droppedSections: z.array(z.string().max(DROPPED_SECTION_LABEL_MAX_LENGTH)).max(DROPPED_SECTIONS_MAX_ITEMS)
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
		createdUtc: z.string().min(1).max(ERROR_REPORT_UTC_MAX_LENGTH),
		category: z.enum([
			ERROR_REPORT_CATEGORY_QUERY,
			ERROR_REPORT_CATEGORY_MUTATION,
			ERROR_REPORT_CATEGORY_RUNTIME,
			ERROR_REPORT_CATEGORY_REACT
		]),
		status: z.enum([ERROR_REPORT_STATUS_PENDING, ERROR_REPORT_STATUS_SENDING, ERROR_REPORT_STATUS_SENT, ERROR_REPORT_STATUS_FAILED]),
		sentUtc: z.string().min(1).max(ERROR_REPORT_UTC_MAX_LENGTH).optional(),
		failedReason: z.string().max(FAILED_REASON_MAX_LENGTH).optional(),
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
	if (!isSerializedInputWithinLimit(value, ERROR_REPORT_PAYLOAD_MAX_BYTES + DRAFT_METADATA_MAX_BYTES)) return undefined;

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
