export type SwCachePolicyMode = "off" | "ttl" | "bust";
export type SwCacheDurationUnit = "ms" | "s" | "m" | "h" | "d";

export interface ParsedSwCachePolicy {
	mode: SwCachePolicyMode;
	amount?: number;
	unit?: SwCacheDurationUnit;
	name?: string;
	maxEntries?: number;
	resolvedMaxEntries?: number;
	ttlMs?: number;
	cacheName?: string;
}

export interface SwCachePolicyDraft {
	mode: SwCachePolicyMode;
	amount?: number;
	unit?: SwCacheDurationUnit;
	name?: string;
	maxEntries?: number;
}

const DEFAULT_ODATA_CACHE_MAX_ENTRIES = 100;
const MAX_ODATA_CACHE_MAX_ENTRIES = 5000;
const MAX_ODATA_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type DurationParseResult = {
	durationLabel: string;
	amount?: number;
	unit?: SwCacheDurationUnit;
	ttlMs: number;
};

export function normalizeSwCacheName(value: string | undefined): string | undefined {
	const normalized = value
		?.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || undefined;
}

function parseDurationToken(value: string): DurationParseResult | undefined {
	const normalized = value.trim().toLowerCase();
	if (normalized === "forever") {
		return {
			durationLabel: "forever",
			ttlMs: Infinity
		};
	}

	const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
	if (!match) return undefined;

	const amount = Number(match[1]);
	const unit = match[2] as SwCacheDurationUnit;
	if (!Number.isFinite(amount) || amount <= 0) return undefined;

	const multiplierByUnit: Record<SwCacheDurationUnit, number> = {
		ms: 1,
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000
	};
	const ttlMs = Math.round(amount * multiplierByUnit[unit]);
	if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_ODATA_CACHE_TTL_MS) return undefined;

	const durationLabel = `${match[1]}${unit}`.replace(".", "_");
	return {
		durationLabel,
		amount,
		unit,
		ttlMs
	};
}

function parseMaxEntries(value: string | undefined): number | undefined {
	if (!value) return undefined;

	const parsed = Number(value.trim());
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;

	return Math.min(parsed, MAX_ODATA_CACHE_MAX_ENTRIES);
}

function createCacheName(duration: DurationParseResult, name: string | undefined, maxEntries: number | undefined) {
	const cacheLabel = name ? `${name}-${duration.durationLabel}` : duration.durationLabel;
	return `odata-${cacheLabel}${maxEntries ? `-max${maxEntries}` : ""}`;
}

export function parseSwCachePolicy(value: string | null | undefined): ParsedSwCachePolicy | undefined {
	const normalized = value?.trim();
	if (!normalized) return undefined;
	if (normalized.toLowerCase() === "off") return { mode: "off" };

	const parts = normalized
		.split(/[;,]/)
		.map((part) => part.trim())
		.filter(Boolean);
	const [modePart, ...optionParts] = parts;
	const [rawMode, rawDuration] = modePart?.split("=", 2) ?? [];
	const mode = rawMode?.toLowerCase();
	if ((mode !== "ttl" && mode !== "bust") || !rawDuration) return undefined;

	const duration = parseDurationToken(rawDuration);
	if (!duration) return undefined;

	const options = new Map(
		optionParts
			.map((part) => part.split("=", 2).map((item) => item.trim()) as [string, string | undefined])
			.map(([key, optionValue]) => [key.toLowerCase(), optionValue] as [string, string | undefined])
			.filter(([key, optionValue]) => Boolean(key && optionValue))
	);
	const maxEntries = parseMaxEntries(options.get("maxentries") ?? options.get("max") ?? options.get("entries"));
	const name = normalizeSwCacheName(options.get("cachename") ?? options.get("cache") ?? options.get("name"));
	const resolvedMaxEntries = maxEntries ?? DEFAULT_ODATA_CACHE_MAX_ENTRIES;

	return {
		mode,
		amount: duration.amount,
		unit: duration.unit,
		name,
		maxEntries,
		resolvedMaxEntries,
		ttlMs: duration.ttlMs,
		cacheName: createCacheName(duration, name, maxEntries)
	};
}

export function resolveSwCacheCacheNameByPolicy(value: string | undefined): string | undefined {
	const parsed = parseSwCachePolicy(value);
	return parsed?.mode === "ttl" || parsed?.mode === "bust" ? parsed.cacheName : undefined;
}

export function buildSwCachePolicyValue(draft: SwCachePolicyDraft): string {
	if (draft.mode === "off") return "off";

	const amount = typeof draft.amount === "number" && Number.isFinite(draft.amount) && draft.amount > 0 ? draft.amount : 24;
	const unit = draft.unit ?? "h";
	const maxEntries =
		typeof draft.maxEntries === "number" && Number.isInteger(draft.maxEntries) && draft.maxEntries > 0
			? Math.min(draft.maxEntries, MAX_ODATA_CACHE_MAX_ENTRIES)
			: undefined;
	const name = normalizeSwCacheName(draft.name);
	const options = [maxEntries ? `max=${maxEntries}` : undefined, name ? `name=${name}` : undefined].filter(Boolean);

	return `${draft.mode}=${amount}${unit}${options.length ? `;${options.join(";")}` : ""}`;
}
