import { loadPrivateSourceMapArtifact, readPrivateSourceMap } from "./artifact";
import { isErrorReportBuildId } from "./manifest";
import {
	PRIVATE_SOURCE_MAP_ARTIFACT_RETENTION_MS,
	type LoadedPrivateSourceMapArtifact,
	type PrivateSourceMapArchiveOptions
} from "./types";

import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ARCHIVE_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1_000;

async function copyArtifact(
	artifact: LoadedPrivateSourceMapArtifact,
	archiveRoot: string,
	application: string,
	buildId: string
): Promise<void> {
	const applicationDirectory = path.join(path.resolve(archiveRoot), application);
	const buildDirectory = path.join(applicationDirectory, buildId);
	const temporaryDirectory = path.join(applicationDirectory, `.${buildId}.tmp-${process.pid}`);
	await mkdir(applicationDirectory, { recursive: true });
	await rm(temporaryDirectory, { force: true, recursive: true });
	await mkdir(temporaryDirectory, { recursive: false });

	try {
		for (const entry of artifact.manifest.entries) {
			const content = await readPrivateSourceMap(artifact, entry);
			const targetPath = path.join(temporaryDirectory, entry.map);
			await mkdir(path.dirname(targetPath), { recursive: true });
			await writeFile(targetPath, content, { encoding: "utf8", flag: "wx" });
		}
		await writeFile(path.join(temporaryDirectory, "manifest.json"), `${JSON.stringify(artifact.manifest, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx"
		});
		await rename(temporaryDirectory, buildDirectory);
	} catch (error) {
		await rm(temporaryDirectory, { force: true, recursive: true });
		const concurrentlyInstalled = await loadPrivateSourceMapArtifact(archiveRoot, application, buildId).catch(() => null);
		if (!concurrentlyInstalled) throw error;
	}
}

/** Устанавливает seed и удаляет только валидные завершённые artifacts старше retention. */
export async function maintainPrivateSourceMapArchive(options: PrivateSourceMapArchiveOptions): Promise<void> {
	if (!isErrorReportBuildId(options.buildId)) return;
	await mkdir(options.archiveRoot, { recursive: true });

	const existing = await loadPrivateSourceMapArtifact(options.archiveRoot, options.application, options.buildId);
	const seed = options.seedRoot ? await loadPrivateSourceMapArtifact(options.seedRoot, options.application, options.buildId) : null;
	if (existing && seed && JSON.stringify(existing.manifest.entries) !== JSON.stringify(seed.manifest.entries)) {
		throw new Error("Persistent source-map artifact не совпадает с image seed для того же build ID.");
	}
	if (!existing && seed) await copyArtifact(seed, options.archiveRoot, options.application, options.buildId);

	const applicationDirectory = path.join(path.resolve(options.archiveRoot), options.application);
	await mkdir(applicationDirectory, { recursive: true });
	const now = (options.now ?? (() => new Date()))().getTime();
	for (const entry of await readdir(applicationDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory() || !isErrorReportBuildId(entry.name) || entry.name === options.buildId) continue;
		try {
			const artifact = await loadPrivateSourceMapArtifact(options.archiveRoot, options.application, entry.name);
			if (!artifact) continue;
			const createdAt = Date.parse(artifact.manifest.createdUtc);
			if (Number.isFinite(createdAt) && createdAt + PRIVATE_SOURCE_MAP_ARTIFACT_RETENTION_MS <= now) {
				await rm(artifact.buildDirectory, { recursive: true });
			}
		} catch {
			// Повреждённый artifact сохраняется как forensic evidence.
		}
	}
}

/** Запускает bounded daily maintenance и возвращает явный cleanup timer. */
export function startPrivateSourceMapArchiveMaintenance(options: PrivateSourceMapArchiveOptions): () => void {
	const run = () => void maintainPrivateSourceMapArchive(options).catch((error: unknown) => options.onError?.(error));
	run();
	const timer = setInterval(run, ARCHIVE_MAINTENANCE_INTERVAL_MS);
	timer.unref();
	return () => clearInterval(timer);
}
