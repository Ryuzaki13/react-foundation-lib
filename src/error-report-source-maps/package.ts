import { isErrorReportBuildId, isPrivateSourceMapApplicationId } from "./manifest";
import {
	SOURCE_MAP_SERVER_BUNDLE_PREFIX,
	SOURCE_MAP_TEXT_ENCODING,
	SOURCE_MAP_KIND_CLIENT,
	SOURCE_MAP_SUFFIX,
	SOURCE_MAP_KIND_SERVER,
	SOURCE_MAP_EXCLUSIVE_WRITE_FLAG,
	SOURCE_MAP_HASH_ALGORITHM,
	SOURCE_MAP_HASH_ENCODING,
	SOURCE_MAP_MANIFEST_FILE_NAME
} from "./sourceMapArtifactConstants";
import {
	PRIVATE_SOURCE_MAP_ARTIFACT_MAX_BYTES,
	PRIVATE_SOURCE_MAP_MANIFEST_VERSION,
	PRIVATE_SOURCE_MAP_MAX_BYTES,
	type PackageErrorReportSourceMapsOptions,
	type PrivateSourceMapManifest,
	type PrivateSourceMapManifestEntry
} from "./types";

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_OUTPUT_DIRECTORY = "public";
const SOURCE_MAP_FORMAT_VERSION = 3;

const SOURCE_MAP_REFERENCE_PATTERN = /(?:\/\*[#@]\s*sourceMappingURL=[^*]*\*\/|\/\/[#@]\s*sourceMappingURL=.*)$/gm;
const PUBLIC_TEXT_ASSET_PATTERN = /\.(?:css|html|js|mjs)$/;
const NITRO_PUBLIC_SOURCE_MAP_ENTRY_PATTERN = /"(\/[^"\n]+\.map)"\s*:\s*\{/;

/** Временное расположение client maps между client и Nitro server build. */
export const STAGED_CLIENT_SOURCE_MAP_DIRECTORY = ".private-source-maps-staging/client";

async function listFiles(directory: string, skippedPaths: ReadonlySet<string> = new Set()): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (skippedPaths.has(path.resolve(entryPath))) continue;
		if (entry.isSymbolicLink()) throw new Error(`Build output содержит недопустимую symbolic link: ${entryPath}`);
		if (entry.isDirectory()) files.push(...(await listFiles(entryPath, skippedPaths)));
		else if (entry.isFile()) files.push(entryPath);
	}
	return files.sort((left, right) => left.localeCompare(right));
}

function validateSourceMap(content: Buffer, filePath: string): void {
	if (content.byteLength === 0 || content.byteLength > PRIVATE_SOURCE_MAP_MAX_BYTES) {
		throw new Error(`Source map выходит за предел ${PRIVATE_SOURCE_MAP_MAX_BYTES} bytes: ${filePath}`);
	}
	let sourceMap: unknown;
	try {
		sourceMap = JSON.parse(content.toString(SOURCE_MAP_TEXT_ENCODING));
	} catch {
		throw new Error(`Source map содержит некорректный JSON: ${filePath}`);
	}
	if (!sourceMap || typeof sourceMap !== "object" || !("version" in sourceMap) || sourceMap.version !== SOURCE_MAP_FORMAT_VERSION) {
		throw new Error(`Source map имеет неподдерживаемый формат: ${filePath}`);
	}
	const sources = "sources" in sourceMap ? sourceMap.sources : undefined;
	const sourcesContent = "sourcesContent" in sourceMap ? sourceMap.sourcesContent : undefined;
	if (!Array.isArray(sources)) throw new Error(`Source map не содержит список sources: ${filePath}`);
	// Nitro вправе не встраивать исходный текст в server maps. Координаты и
	// имена кадров при этом восстанавливаются, а source context просто остаётся
	// недоступным. Если sourcesContent присутствует, проверяем его целостность.
	if (sourcesContent !== undefined && (!Array.isArray(sourcesContent) || sourcesContent.length !== sources.length)) {
		throw new Error(`Source map содержит неполный sourcesContent: ${filePath}`);
	}
}

function resolveArtifactPaths(
	outputRoot: string,
	clientSourceMapStagingRoot: string,
	mapPath: string
): Pick<PrivateSourceMapManifestEntry, "kind" | "bundle" | "map"> {
	const publicRoot = path.join(outputRoot, PUBLIC_OUTPUT_DIRECTORY);
	const serverRoot = path.join(outputRoot, "server");
	const relativeToPublic = path.relative(publicRoot, mapPath);
	if (relativeToPublic && !relativeToPublic.startsWith("..") && !path.isAbsolute(relativeToPublic)) {
		const normalizedMap = relativeToPublic.split(path.sep).join("/");
		return {
			kind: SOURCE_MAP_KIND_CLIENT,
			bundle: `/${normalizedMap.slice(0, -SOURCE_MAP_SUFFIX.length)}`,
			map: `${SOURCE_MAP_KIND_CLIENT}/${normalizedMap}`
		};
	}
	const relativeToStagedClient = path.relative(clientSourceMapStagingRoot, mapPath);
	if (relativeToStagedClient && !relativeToStagedClient.startsWith("..") && !path.isAbsolute(relativeToStagedClient)) {
		const normalizedMap = relativeToStagedClient.split(path.sep).join("/");
		return {
			kind: SOURCE_MAP_KIND_CLIENT,
			bundle: `/${normalizedMap.slice(0, -SOURCE_MAP_SUFFIX.length)}`,
			map: `${SOURCE_MAP_KIND_CLIENT}/${normalizedMap}`
		};
	}
	const relativeToServer = path.relative(serverRoot, mapPath);
	if (relativeToServer && !relativeToServer.startsWith("..") && !path.isAbsolute(relativeToServer)) {
		const normalizedMap = relativeToServer.split(path.sep).join("/");
		return {
			kind: SOURCE_MAP_KIND_SERVER,
			bundle: `${SOURCE_MAP_SERVER_BUNDLE_PREFIX}${normalizedMap.slice(0, -SOURCE_MAP_SUFFIX.length)}`,
			map: `${SOURCE_MAP_KIND_SERVER}/${normalizedMap}`
		};
	}
	throw new Error(`Source map находится вне public/server output: ${mapPath}`);
}

async function stripSourceMapReferences(filePath: string): Promise<void> {
	const source = await readFile(filePath, SOURCE_MAP_TEXT_ENCODING);
	const withoutReferences = source.replace(SOURCE_MAP_REFERENCE_PATTERN, "");
	if (withoutReferences !== source) await writeFile(filePath, withoutReferences, SOURCE_MAP_TEXT_ENCODING);
}

/** Извлекает клиентские карты до формирования Nitro static asset manifest. */
export async function stageClientSourceMapsForNitro(
	outputRoot: string,
	options: { readonly publicRoot?: string; readonly clientSourceMapStagingRoot?: string } = {}
): Promise<number> {
	const resolvedOutputRoot = path.resolve(outputRoot);
	const publicRoot = path.resolve(options.publicRoot ?? path.join(resolvedOutputRoot, PUBLIC_OUTPUT_DIRECTORY));
	const stagingRoot = path.resolve(
		options.clientSourceMapStagingRoot ?? path.join(resolvedOutputRoot, STAGED_CLIENT_SOURCE_MAP_DIRECTORY)
	);
	const publicFiles = await listFiles(publicRoot);
	const sourceMapFiles = publicFiles.filter((filePath) => filePath.endsWith(SOURCE_MAP_SUFFIX));
	for (const mapFile of sourceMapFiles) {
		const relativePath = path.relative(publicRoot, mapFile);
		const stagedPath = path.join(stagingRoot, relativePath);
		await mkdir(path.dirname(stagedPath), { recursive: true });
		await rename(mapFile, stagedPath);
	}
	for (const filePath of publicFiles) {
		if (!filePath.endsWith(SOURCE_MAP_SUFFIX) && PUBLIC_TEXT_ASSET_PATTERN.test(filePath)) await stripSourceMapReferences(filePath);
	}
	return sourceMapFiles.length;
}

/** Проверяет скомпилированный Nitro manifest, а не только оставшиеся файлы. */
export async function assertNoNitroSourceMapManifestLeaks(serverEntryPath: string): Promise<void> {
	const serverEntry = await readFile(serverEntryPath, SOURCE_MAP_TEXT_ENCODING);
	const leakedEntry = NITRO_PUBLIC_SOURCE_MAP_ENTRY_PATTERN.exec(serverEntry)?.[1];
	if (leakedEntry) throw new Error(`Nitro static asset manifest содержит source map: ${leakedEntry}`);
}

/** Доказывает отсутствие карт и sourceMappingURL в public output. */
export async function assertNoPublicSourceMapLeaks(publicRoot: string): Promise<void> {
	for (const filePath of await listFiles(publicRoot)) {
		if (filePath.endsWith(SOURCE_MAP_SUFFIX)) throw new Error(`Public output содержит source map: ${filePath}`);
		if (!PUBLIC_TEXT_ASSET_PATTERN.test(filePath)) continue;
		const source = await readFile(filePath, SOURCE_MAP_TEXT_ENCODING);
		if (source.includes("sourceMappingURL")) throw new Error(`Public output содержит sourceMappingURL: ${filePath}`);
	}
}

/** Извлекает карты из multi-environment output в immutable private artifact. */
export async function packageErrorReportSourceMaps(options: PackageErrorReportSourceMapsOptions): Promise<PrivateSourceMapManifest> {
	if (!isPrivateSourceMapApplicationId(options.application) || !isErrorReportBuildId(options.buildId)) {
		throw new Error("Application или build ID private source-map artifact недопустим.");
	}
	const outputRoot = path.resolve(options.outputRoot);
	const artifactRoot = path.resolve(options.artifactRoot);
	const clientSourceMapStagingRoot = path.resolve(
		options.clientSourceMapStagingRoot ?? path.join(outputRoot, STAGED_CLIENT_SOURCE_MAP_DIRECTORY)
	);
	const buildDirectory = path.join(artifactRoot, options.application, options.buildId);
	const temporaryBuildDirectory = `${buildDirectory}.tmp-${process.pid}`;
	// Nitro v2 создаёт служебное dependency tree с допустимыми package-manager
	// symlink. Оно не является исполняемым bundle output и не участвует в maps.
	const outputFiles = await listFiles(outputRoot, new Set([path.resolve(outputRoot, "server/node_modules")]));
	const stagingIsInsideOutput = (() => {
		const relative = path.relative(outputRoot, clientSourceMapStagingRoot);
		return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
	})();
	const stagedClientFiles = stagingIsInsideOutput ? [] : await listFiles(clientSourceMapStagingRoot);
	const mapFiles = [...outputFiles, ...stagedClientFiles].filter((filePath) => filePath.endsWith(SOURCE_MAP_SUFFIX));
	if (mapFiles.length === 0) throw new Error("Production build не создал private source maps.");

	await rm(temporaryBuildDirectory, { force: true, recursive: true });
	await mkdir(temporaryBuildDirectory, { recursive: true });
	const entries: PrivateSourceMapManifestEntry[] = [];
	let totalBytes = 0;
	try {
		for (const mapFile of mapFiles) {
			const content = await readFile(mapFile);
			validateSourceMap(content, mapFile);
			totalBytes += content.byteLength;
			if (totalBytes > PRIVATE_SOURCE_MAP_ARTIFACT_MAX_BYTES) {
				throw new Error(`Private source-map artifact превышает ${PRIVATE_SOURCE_MAP_ARTIFACT_MAX_BYTES} bytes.`);
			}
			const artifactPaths = resolveArtifactPaths(outputRoot, clientSourceMapStagingRoot, mapFile);
			const targetPath = path.join(temporaryBuildDirectory, artifactPaths.map);
			await mkdir(path.dirname(targetPath), { recursive: true });
			await writeFile(targetPath, content, { flag: SOURCE_MAP_EXCLUSIVE_WRITE_FLAG });
			entries.push({
				...artifactPaths,
				sha256: createHash(SOURCE_MAP_HASH_ALGORITHM).update(content).digest(SOURCE_MAP_HASH_ENCODING),
				size: content.byteLength
			});
		}
		if (!entries.some((entry) => entry.kind === SOURCE_MAP_KIND_CLIENT))
			throw new Error("Private source-map artifact не содержит client maps.");
		if (!entries.some((entry) => entry.kind === SOURCE_MAP_KIND_SERVER))
			throw new Error("Private source-map artifact не содержит server maps.");
		entries.sort((left, right) => left.bundle.localeCompare(right.bundle));
		const manifest: PrivateSourceMapManifest = {
			version: PRIVATE_SOURCE_MAP_MANIFEST_VERSION,
			application: options.application,
			buildId: options.buildId,
			createdUtc: options.createdUtc ?? new Date().toISOString(),
			entries
		};
		await writeFile(path.join(temporaryBuildDirectory, SOURCE_MAP_MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`, {
			encoding: SOURCE_MAP_TEXT_ENCODING,
			flag: SOURCE_MAP_EXCLUSIVE_WRITE_FLAG
		});
		await rm(buildDirectory, { force: true, recursive: true });
		await mkdir(path.dirname(buildDirectory), { recursive: true });
		await rename(temporaryBuildDirectory, buildDirectory);
		for (const mapFile of mapFiles) await unlink(mapFile);
		for (const filePath of outputFiles) {
			if (!filePath.endsWith(SOURCE_MAP_SUFFIX) && PUBLIC_TEXT_ASSET_PATTERN.test(filePath)) await stripSourceMapReferences(filePath);
		}
		await assertNoPublicSourceMapLeaks(path.join(outputRoot, PUBLIC_OUTPUT_DIRECTORY));
		await assertNoNitroSourceMapManifestLeaks(path.join(outputRoot, "server/index.mjs"));
		const manifestStat = await stat(path.join(buildDirectory, SOURCE_MAP_MANIFEST_FILE_NAME));
		if (!manifestStat.isFile()) throw new Error("Private source-map manifest не был создан.");
		return manifest;
	} catch (error) {
		await rm(temporaryBuildDirectory, { force: true, recursive: true });
		throw error;
	}
}
