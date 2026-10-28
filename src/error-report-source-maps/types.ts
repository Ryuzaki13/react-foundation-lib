import { type SOURCE_MAP_KIND_CLIENT, type SOURCE_MAP_KIND_SERVER } from "./sourceMapArtifactConstants";
import {
	type SYMBOLICATION_NOT_REQUIRED,
	type SYMBOLICATION_RESOLVED,
	type SYMBOLICATION_MAPS_UNAVAILABLE,
	type SYMBOLICATION_FAILED
} from "./symbolicationResultConstants";
/** Версия immutable manifest, общего для build packager и server reader. */
export const PRIVATE_SOURCE_MAP_MANIFEST_VERSION = 1 as const;

/**
 * Лимиты едины для build и runtime: packager не должен создавать artifact,
 * который server reader затем не сможет безопасно прочитать.
 */
export const PRIVATE_SOURCE_MAP_MANIFEST_MAX_BYTES = 2 * 1024 * 1024;
export const PRIVATE_SOURCE_MAP_MAX_BYTES = 32 * 1024 * 1024;
export const PRIVATE_SOURCE_MAP_ARTIFACT_MAX_BYTES = 256 * 1024 * 1024;
export const PRIVATE_SOURCE_MAP_ARTIFACT_RETENTION_MS = 97 * 24 * 60 * 60 * 1_000;

export type PrivateSourceMapManifestEntry = {
	readonly kind: typeof SOURCE_MAP_KIND_CLIENT | typeof SOURCE_MAP_KIND_SERVER;
	readonly bundle: string;
	readonly map: string;
	readonly sha256: string;
	readonly size: number;
};

export type PrivateSourceMapManifest = {
	readonly version: typeof PRIVATE_SOURCE_MAP_MANIFEST_VERSION;
	readonly application: string;
	readonly buildId: string;
	readonly createdUtc: string;
	readonly entries: readonly PrivateSourceMapManifestEntry[];
};

export type LoadedPrivateSourceMapArtifact = {
	readonly buildDirectory: string;
	readonly manifest: PrivateSourceMapManifest;
	readonly entriesByBundle: ReadonlyMap<string, PrivateSourceMapManifestEntry>;
};

export type ErrorReportSourceContextLine = {
	readonly line: number;
	readonly content: string;
	readonly focus: boolean;
};

export type ErrorReportStackFrame = {
	readonly functionName?: string;
	readonly generated: {
		readonly source: string;
		readonly line: number;
		readonly column: number;
	};
	readonly original?: {
		readonly source: string;
		readonly line: number;
		readonly column: number;
		readonly name?: string;
	};
	readonly sourceContext?: readonly ErrorReportSourceContextLine[];
};

export type ErrorReportSymbolicationResult = {
	readonly status:
		| typeof SYMBOLICATION_NOT_REQUIRED
		| typeof SYMBOLICATION_RESOLVED
		| typeof SYMBOLICATION_MAPS_UNAVAILABLE
		| typeof SYMBOLICATION_FAILED;
	readonly stackTrace?: string;
	readonly frames?: readonly ErrorReportStackFrame[];
};

export type PackageErrorReportSourceMapsOptions = {
	readonly outputRoot: string;
	readonly artifactRoot: string;
	/** Staging вне outputRoot нужен, когда Nitro очищает свой output после client build. */
	readonly clientSourceMapStagingRoot?: string;
	readonly application: string;
	readonly buildId: string;
	readonly createdUtc?: string;
};

export type PrivateSourceMapArchiveOptions = {
	readonly archiveRoot: string;
	readonly seedRoot?: string;
	readonly application: string;
	readonly buildId: string;
	readonly now?: () => Date;
	readonly onError?: (error: unknown) => void;
};

export type SymbolicateErrorReportStackOptions = {
	readonly artifactRoots?: readonly string[];
};
