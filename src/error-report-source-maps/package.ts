import { isErrorReportBuildId, isPrivateSourceMapApplicationId } from "./manifest";
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
		sourceMap = JSON.parse(content.toString("utf8"));
	} catch {
		throw new Error(`Source map содержит некорректный JSON: ${filePath}`);
	}
	if (!sourceMap || typeof sourceMap !== "object" || !("version" in sourceMap) || sourceMap.version !== 3) {
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

function resolveArtifactPaths(outputRoot: string, mapPath: string): Pick<PrivateSourceMapManifestEntry, "kind" | "bundle" | "map"> {
	const publicRoot = path.join(outputRoot, "public");
	const serverRoot = path.join(outputRoot, "server");
	const stagedClientRoot = path.join(outputRoot, STAGED_CLIENT_SOURCE_MAP_DIRECTORY);
	const relativeToPublic = path.relative(publicRoot, mapPath);
	if (relativeToPublic && !relativeToPublic.startsWith("..") && !path.isAbsolute(relativeToPublic)) {
		const normalizedMap = relativeToPublic.split(path.sep).join("/");
		return { kind: "client", bundle: `/${normalizedMap.slice(0, -".map".length)}`, map: `client/${normalizedMap}` };
	}
	const relativeToStagedClient = path.relative(stagedClientRoot, mapPath);
	if (relativeToStagedClient && !relativeToStagedClient.startsWith("..") && !path.isAbsolute(relativeToStagedClient)) {
		const normalizedMap = relativeToStagedClient.split(path.sep).join("/");
		return { kind: "client", bundle: `/${normalizedMap.slice(0, -".map".length)}`, map: `client/${normalizedMap}` };
	}
	const relativeToServer = path.relative(serverRoot, mapPath);
	if (relativeToServer && !relativeToServer.startsWith("..") && !path.isAbsolute(relativeToServer)) {
		const normalizedMap = relativeToServer.split(path.sep).join("/");
		return { kind: "server", bundle: `server/${normalizedMap.slice(0, -".map".length)}`, map: `server/${normalizedMap}` };
	}
	throw new Error(`Source map находится вне public/server output: ${mapPath}`);
}

async function stripSourceMapReferences(filePath: string): Promise<void> {
	const source = await readFile(filePath, "utf8");
	const withoutReferences = source.replace(SOURCE_MAP_REFERENCE_PATTERN, "");
	if (withoutReferences !== source) await writeFile(filePath, withoutReferences, "utf8");
}

/** Извлекает клиентские карты до формирования Nitro static asset manifest. */
export async function stageClientSourceMapsForNitro(outputRoot: string, options: { readonly publicRoot?: string } = {}): Promise<number> {
	const resolvedOutputRoot = path.resolve(outputRoot);
	const publicRoot = path.resolve(options.publicRoot ?? path.join(resolvedOutputRoot, "public"));
	const stagingRoot = path.join(resolvedOutputRoot, STAGED_CLIENT_SOURCE_MAP_DIRECTORY);
	const publicFiles = await listFiles(publicRoot);
	const sourceMapFiles = publicFiles.filter((filePath) => filePath.endsWith(".map"));
	for (const mapFile of sourceMapFiles) {
		const relativePath = path.relative(publicRoot, mapFile);
		const stagedPath = path.join(stagingRoot, relativePath);
		await mkdir(path.dirname(stagedPath), { recursive: true });
		await rename(mapFile, stagedPath);
	}
	for (const filePath of publicFiles) {
		if (!filePath.endsWith(".map") && PUBLIC_TEXT_ASSET_PATTERN.test(filePath)) await stripSourceMapReferences(filePath);
	}
	return sourceMapFiles.length;
}

/** Проверяет скомпилированный Nitro manifest, а не только оставшиеся файлы. */
export async function assertNoNitroSourceMapManifestLeaks(serverEntryPath: string): Promise<void> {
	const serverEntry = await readFile(serverEntryPath, "utf8");
	const leakedEntry = NITRO_PUBLIC_SOURCE_MAP_ENTRY_PATTERN.exec(serverEntry)?.[1];
	if (leakedEntry) throw new Error(`Nitro static asset manifest содержит source map: ${leakedEntry}`);
}

/** Доказывает отсутствие карт и sourceMappingURL в public output. */
export async function assertNoPublicSourceMapLeaks(publicRoot: string): Promise<void> {
	for (const filePath of await listFiles(publicRoot)) {
		if (filePath.endsWith(".map")) throw new Error(`Public output содержит source map: ${filePath}`);
		if (!PUBLIC_TEXT_ASSET_PATTERN.test(filePath)) continue;
		const source = await readFile(filePath, "utf8");
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
	const buildDirectory = path.join(artifactRoot, options.application, options.buildId);
	const temporaryBuildDirectory = `${buildDirectory}.tmp-${process.pid}`;
	// Nitro v2 создаёт служебное dependency tree с допустимыми package-manager
	// symlink. Оно не является исполняемым bundle output и не участвует в maps.
	const outputFiles = await listFiles(outputRoot, new Set([path.resolve(outputRoot, "server/node_modules")]));
	const mapFiles = outputFiles.filter((filePath) => filePath.endsWith(".map"));
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
			const artifactPaths = resolveArtifactPaths(outputRoot, mapFile);
			const targetPath = path.join(temporaryBuildDirectory, artifactPaths.map);
			await mkdir(path.dirname(targetPath), { recursive: true });
			await writeFile(targetPath, content, { flag: "wx" });
			entries.push({
				...artifactPaths,
				sha256: createHash("sha256").update(content).digest("hex"),
				size: content.byteLength
			});
		}
		if (!entries.some((entry) => entry.kind === "client")) throw new Error("Private source-map artifact не содержит client maps.");
		if (!entries.some((entry) => entry.kind === "server")) throw new Error("Private source-map artifact не содержит server maps.");
		entries.sort((left, right) => left.bundle.localeCompare(right.bundle));
		const manifest: PrivateSourceMapManifest = {
			version: PRIVATE_SOURCE_MAP_MANIFEST_VERSION,
			application: options.application,
			buildId: options.buildId,
			createdUtc: options.createdUtc ?? new Date().toISOString(),
			entries
		};
		await writeFile(path.join(temporaryBuildDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx"
		});
		await rm(buildDirectory, { force: true, recursive: true });
		await mkdir(path.dirname(buildDirectory), { recursive: true });
		await rename(temporaryBuildDirectory, buildDirectory);
		for (const mapFile of mapFiles) await unlink(mapFile);
		for (const filePath of outputFiles) {
			if (!filePath.endsWith(".map") && PUBLIC_TEXT_ASSET_PATTERN.test(filePath)) await stripSourceMapReferences(filePath);
		}
		await assertNoPublicSourceMapLeaks(path.join(outputRoot, "public"));
		await assertNoNitroSourceMapManifestLeaks(path.join(outputRoot, "server/index.mjs"));
		const manifestStat = await stat(path.join(buildDirectory, "manifest.json"));
		if (!manifestStat.isFile()) throw new Error("Private source-map manifest не был создан.");
		return manifest;
	} catch (error) {
		await rm(temporaryBuildDirectory, { force: true, recursive: true });
		throw error;
	}
}
