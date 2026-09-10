import { isErrorReportBuildId, isPrivateSourceMapApplicationId, parsePrivateSourceMapManifest } from "./manifest";
import { PRIVATE_SOURCE_MAP_MANIFEST_MAX_BYTES, type LoadedPrivateSourceMapArtifact, type PrivateSourceMapManifestEntry } from "./types";

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export class PrivateSourceMapArtifactError extends Error {
	public constructor() {
		super("Private source-map artifact не прошёл проверку целостности.");
		this.name = "PrivateSourceMapArtifactError";
	}
}

function isMissingFileError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isPathInside(parent: string, candidate: string): boolean {
	const relativePath = path.relative(parent, candidate);
	return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

async function readBoundedRegularFile(filePath: string, buildDirectory: string, maxBytes: number): Promise<Buffer> {
	const fileInfo = await lstat(filePath);
	if (!fileInfo.isFile() || fileInfo.isSymbolicLink() || fileInfo.size <= 0 || fileInfo.size > maxBytes) {
		throw new PrivateSourceMapArtifactError();
	}
	const resolvedFilePath = await realpath(filePath);
	if (!isPathInside(buildDirectory, resolvedFilePath)) throw new PrivateSourceMapArtifactError();
	const content = await readFile(resolvedFilePath);
	if (content.byteLength !== fileInfo.size) throw new PrivateSourceMapArtifactError();
	return content;
}

/** Загружает manifest только из каталога точного application/build ID. */
export async function loadPrivateSourceMapArtifact(
	root: string,
	application: string,
	buildId: string
): Promise<LoadedPrivateSourceMapArtifact | null> {
	if (!isPrivateSourceMapApplicationId(application) || !isErrorReportBuildId(buildId)) throw new PrivateSourceMapArtifactError();

	let resolvedRoot: string;
	let buildDirectory: string;
	try {
		resolvedRoot = await realpath(path.resolve(root));
		buildDirectory = await realpath(path.join(resolvedRoot, application, buildId));
	} catch (error) {
		if (isMissingFileError(error)) return null;
		throw new PrivateSourceMapArtifactError();
	}
	if (!isPathInside(resolvedRoot, buildDirectory)) throw new PrivateSourceMapArtifactError();

	let manifestContent: Buffer;
	try {
		manifestContent = await readBoundedRegularFile(
			path.join(buildDirectory, "manifest.json"),
			buildDirectory,
			PRIVATE_SOURCE_MAP_MANIFEST_MAX_BYTES
		);
	} catch (error) {
		if (isMissingFileError(error)) return null;
		if (error instanceof PrivateSourceMapArtifactError) throw error;
		throw new PrivateSourceMapArtifactError();
	}

	let rawManifest: unknown;
	try {
		rawManifest = JSON.parse(manifestContent.toString("utf8"));
	} catch {
		throw new PrivateSourceMapArtifactError();
	}
	const manifest = parsePrivateSourceMapManifest(rawManifest);
	if (!manifest || manifest.application !== application || manifest.buildId !== buildId) throw new PrivateSourceMapArtifactError();

	return {
		buildDirectory,
		manifest,
		entriesByBundle: new Map(manifest.entries.map((entry) => [entry.bundle, entry]))
	};
}

/** Читает карту только после size/hash verification из manifest. */
export async function readPrivateSourceMap(
	artifact: LoadedPrivateSourceMapArtifact,
	entry: PrivateSourceMapManifestEntry
): Promise<string> {
	try {
		const content = await readBoundedRegularFile(path.join(artifact.buildDirectory, entry.map), artifact.buildDirectory, entry.size);
		if (content.byteLength !== entry.size || createHash("sha256").update(content).digest("hex") !== entry.sha256) {
			throw new PrivateSourceMapArtifactError();
		}
		return content.toString("utf8");
	} catch (error) {
		if (error instanceof PrivateSourceMapArtifactError) throw error;
		throw new PrivateSourceMapArtifactError();
	}
}
