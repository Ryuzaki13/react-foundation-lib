import { AnyMap, originalPositionFor, sourceContentFor, type TraceMap } from "@jridgewell/trace-mapping";

import { loadPrivateSourceMapArtifact, readPrivateSourceMap } from "./artifact";
import {
	type ErrorReportStackFrame,
	type ErrorReportSymbolicationResult,
	type LoadedPrivateSourceMapArtifact,
	type PrivateSourceMapManifestEntry,
	type SymbolicateErrorReportStackOptions
} from "./types";

const MAX_STACK_FRAMES = 40;
const MAX_CONTEXT_FRAMES = 10;
const CONTEXT_RADIUS = 2;
const MAX_SOURCE_LINE_LENGTH = 500;
const MAX_SYMBOLICATED_STACK_LENGTH = 262_144;

type ParsedStackFrame = {
	readonly lineIndex: number;
	readonly style: "chromium" | "safari";
	readonly functionName?: string;
	readonly source: string;
	readonly line: number;
	readonly column: number;
	readonly bundle: string;
};

function parsePositiveInteger(value: string): number | null {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeFunctionName(value: string | undefined): string | undefined {
	const normalized = value
		?.trim()
		.replace(/^async\s+/, "")
		.slice(0, 256);
	return normalized || undefined;
}

function safeUrlPathname(value: string): string | null {
	try {
		return new URL(value).pathname;
	} catch {
		return null;
	}
}

function resolveBundle(source: string): string | null {
	const withoutLocationSuffix = source.replace(/[?#].*$/, "").replaceAll("\\", "/");
	const urlPathname = safeUrlPathname(withoutLocationSuffix);
	const normalized = (urlPathname ?? withoutLocationSuffix).replaceAll("\\", "/");
	if (normalized.startsWith("/static/") || normalized === "/sw.js" || normalized === "/sw.mjs") return normalized;
	if (normalized.startsWith("server/")) return normalized;
	const serverMarker = normalized.lastIndexOf("/server/");
	return serverMarker >= 0 ? `server/${normalized.slice(serverMarker + "/server/".length)}` : null;
}

function parseStackFrame(line: string, lineIndex: number): ParsedStackFrame | null {
	const chromiumWithFunction = /^\s*at\s+(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/.exec(line);
	const chromiumBare = /^\s*at\s+(.+):(\d+):(\d+)\s*$/.exec(line);
	const safari = /^([^@]*)@(.+):(\d+):(\d+)\s*$/.exec(line);
	const match = chromiumWithFunction ?? chromiumBare ?? safari;
	if (!match) return null;

	const hasChromiumFunction = match === chromiumWithFunction;
	const hasSafariFunction = match === safari;
	const sourceIndex = hasChromiumFunction ? 2 : hasSafariFunction ? 2 : 1;
	const source = match[sourceIndex];
	const generatedLine = match[sourceIndex + 1] ? parsePositiveInteger(match[sourceIndex + 1]) : null;
	const generatedColumn = match[sourceIndex + 2] ? parsePositiveInteger(match[sourceIndex + 2]) : null;
	if (!source || generatedLine === null || generatedColumn === null) return null;
	const bundle = resolveBundle(source);
	if (!bundle) return null;
	return {
		lineIndex,
		style: hasSafariFunction ? "safari" : "chromium",
		functionName: normalizeFunctionName(hasChromiumFunction || hasSafariFunction ? match[1] : undefined),
		source,
		line: generatedLine,
		column: generatedColumn,
		bundle
	};
}

function normalizeOriginalSource(source: string): string {
	const normalized = source
		.replaceAll("\\", "/")
		.replace(/[?#].*$/, "")
		.replaceAll("\0", "");
	for (const marker of ["/src/", "/config/", "/scripts/", "/node_modules/"] as const) {
		const markerIndex = normalized.lastIndexOf(marker);
		if (markerIndex >= 0) return normalized.slice(markerIndex + 1).slice(0, 1_024);
	}
	for (const prefix of ["src/", "config/", "scripts/", "node_modules/"] as const) {
		const prefixIndex = normalized.indexOf(prefix);
		if (prefixIndex >= 0) return normalized.slice(prefixIndex).slice(0, 1_024);
	}
	const filename = normalized.split("/").filter(Boolean).at(-1) ?? "unknown-source";
	return `source/${filename.slice(0, 512)}`;
}

function createSourceContext(traceMap: TraceMap, source: string, line: number) {
	const content = sourceContentFor(traceMap, source);
	if (content === null) return undefined;
	const lines = content.split(/\r?\n/);
	const firstLine = Math.max(1, line - CONTEXT_RADIUS);
	const lastLine = Math.min(lines.length, line + CONTEXT_RADIUS);
	return Array.from({ length: lastLine - firstLine + 1 }, (_, index) => {
		const sourceLine = firstLine + index;
		return { line: sourceLine, content: (lines[sourceLine - 1] ?? "").slice(0, MAX_SOURCE_LINE_LENGTH), focus: sourceLine === line };
	});
}

function formatSymbolicatedLine(frame: ParsedStackFrame, resolved: ErrorReportStackFrame): string {
	const original = resolved.original;
	if (!original) return "";
	const functionName = original.name ?? frame.functionName;
	const location = `${original.source}:${original.line}:${original.column}`;
	if (frame.style === "safari") return `${functionName ?? "global code"}@${location}`;
	return functionName ? `    at ${functionName} (${location})` : `    at ${location}`;
}

async function findArtifact(
	roots: readonly string[],
	application: string,
	buildId: string
): Promise<LoadedPrivateSourceMapArtifact | null> {
	for (const root of roots) {
		const artifact = await loadPrivateSourceMapArtifact(root, application, buildId);
		if (artifact) return artifact;
	}
	return null;
}

function resolveDefaultArtifactRoots(): string[] {
	return [process.env.ERROR_REPORT_SOURCE_MAP_SEED_ROOT, process.env.ERROR_REPORT_SOURCE_MAP_ROOT].filter((root): root is string =>
		Boolean(root)
	);
}

/** Символизирует только bundle frames из artifact того же application/build ID. */
export async function symbolicateErrorReportStack(
	application: string,
	buildId: string,
	stackTrace: string | undefined,
	options: SymbolicateErrorReportStackOptions = {}
): Promise<ErrorReportSymbolicationResult> {
	if (!stackTrace?.trim()) return { status: "not-required" };
	const stackLines = stackTrace.split("\n");
	const parsedFrames = stackLines.map(parseStackFrame).filter((frame): frame is ParsedStackFrame => frame !== null);
	if (parsedFrames.length === 0) return { status: "not-required" };
	const boundedFrames = parsedFrames.slice(0, MAX_STACK_FRAMES);
	const generatedFrames = boundedFrames.map<ErrorReportStackFrame>((frame) => ({
		...(frame.functionName ? { functionName: frame.functionName } : {}),
		generated: { source: frame.bundle, line: frame.line, column: frame.column }
	}));

	try {
		const artifact = await findArtifact(options.artifactRoots ?? resolveDefaultArtifactRoots(), application, buildId);
		if (!artifact) return { status: "maps-unavailable", frames: generatedFrames };
		const traceMaps = new Map<string, TraceMap>();
		const resultFrames: ErrorReportStackFrame[] = [];
		let failed = parsedFrames.length > MAX_STACK_FRAMES;
		let contextFrames = 0;

		for (const frame of boundedFrames) {
			const entry: PrivateSourceMapManifestEntry | undefined = artifact.entriesByBundle.get(frame.bundle);
			if (!entry) {
				failed = true;
				resultFrames.push({
					...(frame.functionName ? { functionName: frame.functionName } : {}),
					generated: { source: frame.bundle, line: frame.line, column: frame.column }
				});
				continue;
			}

			let traceMap = traceMaps.get(entry.map);
			if (!traceMap) {
				traceMap = new AnyMap(await readPrivateSourceMap(artifact, entry), entry.map);
				traceMaps.set(entry.map, traceMap);
			}
			const original = originalPositionFor(traceMap, { line: frame.line, column: frame.column - 1 });
			if (original.source === null || original.line === null || original.column === null) {
				failed = true;
				resultFrames.push({
					...(frame.functionName ? { functionName: frame.functionName } : {}),
					generated: { source: frame.bundle, line: frame.line, column: frame.column }
				});
				continue;
			}

			const sourceContext =
				contextFrames < MAX_CONTEXT_FRAMES ? createSourceContext(traceMap, original.source, original.line) : undefined;
			if (sourceContext) contextFrames += 1;
			const resolvedFrame: ErrorReportStackFrame = {
				...(frame.functionName ? { functionName: frame.functionName } : {}),
				generated: { source: frame.bundle, line: frame.line, column: frame.column },
				original: {
					source: normalizeOriginalSource(original.source),
					line: original.line,
					column: original.column + 1,
					...(original.name ? { name: original.name.slice(0, 256) } : {})
				},
				...(sourceContext ? { sourceContext } : {})
			};
			resultFrames.push(resolvedFrame);
			stackLines[frame.lineIndex] = formatSymbolicatedLine(frame, resolvedFrame);
		}

		const hasResolvedFrame = resultFrames.some((frame) => frame.original !== undefined);
		return {
			status: failed || !hasResolvedFrame ? "failed" : "resolved",
			...(hasResolvedFrame ? { stackTrace: stackLines.join("\n").slice(0, MAX_SYMBOLICATED_STACK_LENGTH) } : {}),
			frames: resultFrames
		};
	} catch {
		return { status: "failed", frames: generatedFrames };
	}
}
