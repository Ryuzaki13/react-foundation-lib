import type { BaseMetaType } from "./types";

export const BASE_META_TYPES = Object.freeze(["string", "number", "boolean", "date"] as const) satisfies readonly BaseMetaType[];

const BASE_META_TYPE_SET: ReadonlySet<string> = new Set(BASE_META_TYPES);

export const BASE_META_TYPE_LABELS: Readonly<Record<BaseMetaType, string>> = Object.freeze({
	string: "строка",
	number: "число",
	boolean: "boolean",
	date: "дата"
});

export function isBaseMetaType(type: unknown): type is BaseMetaType {
	return typeof type === "string" && BASE_META_TYPE_SET.has(type);
}

export function resolveBaseTypeLabel(type: BaseMetaType): string {
	return BASE_META_TYPE_LABELS[type];
}
