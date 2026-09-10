import { z } from "zod";

import {
	ERROR_REPORT_BUILD_ID_PATTERN,
	PRIVATE_SOURCE_MAP_ARTIFACT_MAX_BYTES,
	PRIVATE_SOURCE_MAP_MANIFEST_VERSION,
	PRIVATE_SOURCE_MAP_MAX_BYTES,
	type PrivateSourceMapManifest
} from "./types";

const APPLICATION_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function isNormalizedRelativePath(value: string): boolean {
	if (!value || value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
	return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isNormalizedBundlePath(value: string, kind: "client" | "server"): boolean {
	if (value.includes("\\") || value.includes("\0") || value.includes("?") || value.includes("#")) return false;
	if (kind === "client") return value.startsWith("/") && isNormalizedRelativePath(value.slice(1));
	return value.startsWith("server/") && isNormalizedRelativePath(value);
}

const privateSourceMapManifestEntrySchema = z
	.object({
		kind: z.enum(["client", "server"]),
		bundle: z.string().max(1_024),
		map: z.string().max(1_024),
		sha256: z.string().regex(SHA256_PATTERN),
		size: z.number().int().positive().max(PRIVATE_SOURCE_MAP_MAX_BYTES)
	})
	.strict()
	.superRefine((entry, context) => {
		if (!isNormalizedBundlePath(entry.bundle, entry.kind)) {
			context.addIssue({ code: "custom", path: ["bundle"], message: "Bundle path должен быть нормализован." });
		}
		if (!isNormalizedRelativePath(entry.map) || !entry.map.startsWith(`${entry.kind}/`) || !entry.map.endsWith(".map")) {
			context.addIssue({ code: "custom", path: ["map"], message: "Map path должен оставаться внутри kind-каталога." });
		}
	});

const privateSourceMapManifestSchema = z
	.object({
		version: z.literal(PRIVATE_SOURCE_MAP_MANIFEST_VERSION),
		application: z.string().min(1).max(128).regex(APPLICATION_ID_PATTERN),
		buildId: z.string().regex(ERROR_REPORT_BUILD_ID_PATTERN),
		createdUtc: z.iso.datetime({ offset: true }),
		entries: z.array(privateSourceMapManifestEntrySchema).max(10_000)
	})
	.strict()
	.superRefine((manifest, context) => {
		const bundles = new Set<string>();
		const maps = new Set<string>();
		let totalBytes = 0;
		for (const [index, entry] of manifest.entries.entries()) {
			if (bundles.has(entry.bundle)) {
				context.addIssue({ code: "custom", path: ["entries", index, "bundle"], message: "Bundle должен быть уникальным." });
			}
			if (maps.has(entry.map)) {
				context.addIssue({ code: "custom", path: ["entries", index, "map"], message: "Map path должен быть уникальным." });
			}
			bundles.add(entry.bundle);
			maps.add(entry.map);
			totalBytes += entry.size;
		}
		if (totalBytes > PRIVATE_SOURCE_MAP_ARTIFACT_MAX_BYTES) {
			context.addIssue({ code: "custom", path: ["entries"], message: "Private source-map artifact превышает общий предел." });
		}
	});

/** Проверяет manifest до любого обращения к указанным в нём файлам. */
export function parsePrivateSourceMapManifest(value: unknown): PrivateSourceMapManifest | null {
	const parsed = privateSourceMapManifestSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** Проверяет недоверенные application/build path segments до filesystem access. */
export function isPrivateSourceMapApplicationId(value: unknown): value is string {
	return typeof value === "string" && value.length <= 128 && APPLICATION_ID_PATTERN.test(value);
}

export function isErrorReportBuildId(value: unknown): value is string {
	return typeof value === "string" && ERROR_REPORT_BUILD_ID_PATTERN.test(value);
}
