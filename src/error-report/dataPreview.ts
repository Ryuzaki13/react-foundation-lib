import { getUtf8TextSize } from "./safeValue";

import type { ErrorReportDataPreview, ErrorReportSafeValue } from "./types";

const MAX_PREVIEW_DEPTH = 6;
const MAX_PREVIEW_ARRAY_ITEMS = 12;
const MAX_PREVIEW_OBJECT_KEYS = 24;
const MAX_PREVIEW_STRING_LENGTH = 1_024;
const MAX_PREVIEW_NODES = 128;

type PreviewState = {
	seen: WeakSet<object>;
	nodesLeft: number;
	truncated: boolean;
};

/**
 * Строит конечное JSON-дерево без изменения исходного кэша. Структурные лимиты
 * защищают capture от больших коллекций ещё до проверки итоговых UTF-8 байтов.
 */
function describePreviewValue(value: unknown, depth: number, state: PreviewState): ErrorReportSafeValue {
	if (depth >= MAX_PREVIEW_DEPTH || state.nodesLeft-- <= 0) {
		state.truncated = true;
		return { type: "truncated" };
	}
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : { type: "non-finite-number" };
	if (typeof value === "string") {
		if (value.length > MAX_PREVIEW_STRING_LENGTH) state.truncated = true;
		const prefix = value.slice(0, MAX_PREVIEW_STRING_LENGTH);
		const lastCodeUnit = prefix.charCodeAt(prefix.length - 1);
		return lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff ? prefix.slice(0, -1) : prefix;
	}
	if (typeof value === "bigint") return value.toString();
	if (value === undefined) return { type: "undefined" };
	if (typeof value === "function") return { type: "function" };
	if (typeof value === "symbol") return { type: "symbol" };
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? { type: "invalid-date" } : value.toISOString();
	if (typeof value !== "object") return { type: "unknown" };
	if (state.seen.has(value)) return { type: "circular" };
	state.seen.add(value);

	if (Array.isArray(value)) {
		if (value.length > MAX_PREVIEW_ARRAY_ITEMS) state.truncated = true;
		return value.slice(0, MAX_PREVIEW_ARRAY_ITEMS).map((item) => describePreviewValue(item, depth + 1, state));
	}

	try {
		const entries = Object.entries(value);
		if (entries.length > MAX_PREVIEW_OBJECT_KEYS) state.truncated = true;
		return Object.fromEntries(
			entries.slice(0, MAX_PREVIEW_OBJECT_KEYS).map(([key, item]) => [key, describePreviewValue(item, depth + 1, state)])
		);
	} catch {
		return { type: "unreadable" };
	}
}

function shortenRootString(value: string): string {
	const codePoints = Array.from(value);
	return codePoints.slice(0, Math.floor(codePoints.length / 2)).join("");
}

/** Сокращает хвост дерева, сохраняя исходную форму первых полей и элементов. */
function shrinkPreviewValue(value: ErrorReportSafeValue): { value: ErrorReportSafeValue; changed: boolean } {
	if (typeof value === "string") {
		return value ? { value: shortenRootString(value), changed: true } : { value, changed: false };
	}
	if (Array.isArray(value)) {
		if (value.length > 1) {
			value.pop();
			return { value, changed: true };
		}
		if (value.length === 1) {
			const item = shrinkPreviewValue(value[0]);
			if (item.changed) {
				value[0] = item.value;
				return { value, changed: true };
			}
			value.pop();
			return { value, changed: true };
		}
		return { value, changed: false };
	}
	if (value !== null && typeof value === "object") {
		const keys = Object.keys(value);
		const lastKey = keys.at(-1);
		if (lastKey === undefined) return { value, changed: false };
		if (keys.length === 1) {
			const item = shrinkPreviewValue(value[lastKey]);
			if (item.changed) {
				value[lastKey] = item.value;
				return { value, changed: true };
			}
		}
		Reflect.deleteProperty(value, lastKey);
		return { value, changed: true };
	}
	return { value, changed: false };
}

/**
 * Возвращает валидный JSON в заданном байтовом бюджете. `truncated` фиксирует
 * как структурное усечение, так и сокращение по размеру сериализованного JSON.
 */
export function createErrorReportDataPreview(value: unknown, maxBytes: number): ErrorReportDataPreview {
	const state: PreviewState = { seen: new WeakSet(), nodesLeft: MAX_PREVIEW_NODES, truncated: false };
	let previewValue = describePreviewValue(value, 0, state);
	let json = JSON.stringify(previewValue);
	const byteLimit = Math.max(4, maxBytes);

	while (getUtf8TextSize(json) > byteLimit) {
		state.truncated = true;
		const reduced = shrinkPreviewValue(previewValue);
		previewValue = reduced.changed ? reduced.value : null;
		json = JSON.stringify(previewValue);
	}

	return { json, truncated: state.truncated };
}
