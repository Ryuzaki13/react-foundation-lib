import { afterEach, describe, expect, it } from "vitest";

import { maintainPrivateSourceMapArchive } from "./archive";
import { loadPrivateSourceMapArtifact, PrivateSourceMapArtifactError, readPrivateSourceMap } from "./artifact";
import { parsePrivateSourceMapManifest } from "./manifest";
import { packageErrorReportSourceMaps, stageClientSourceMapsForNitro } from "./package";
import { symbolicateErrorReportStack } from "./symbolicate";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const APPLICATION = "ru.example-application";
const BUILD_ID = "a".repeat(40);
const OLD_BUILD_ID = "b".repeat(40);
const SOURCE_MAP = JSON.stringify({
	version: 3,
	file: "app.js",
	sources: ["../../src/example.ts"],
	sourcesContent: ["export function explode() {\n\tthrow new Error();\n}\n"],
	names: ["explode"],
	mappings: "AAAAA"
});
const SOURCE_MAP_WITHOUT_SOURCES_CONTENT = JSON.stringify({
	version: 3,
	file: "server.mjs",
	sources: ["../../src/server.ts"],
	names: ["serverFailure"],
	mappings: "AAAAA"
});
const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

function createManifest(buildId = BUILD_ID, createdUtc = "2026-09-10T00:00:00.000Z", mapContent = SOURCE_MAP) {
	return {
		version: 1,
		application: APPLICATION,
		buildId,
		createdUtc,
		entries: [
			{
				kind: "client",
				bundle: "/static/app.js",
				map: "client/static/app.js.map",
				sha256: createHash("sha256").update(mapContent).digest("hex"),
				size: Buffer.byteLength(mapContent)
			}
		]
	};
}

async function writeArtifact(root: string, buildId = BUILD_ID, createdUtc?: string, mapContent = SOURCE_MAP): Promise<void> {
	const buildDirectory = path.join(root, APPLICATION, buildId);
	const mapPath = path.join(buildDirectory, "client/static/app.js.map");
	await mkdir(path.dirname(mapPath), { recursive: true });
	await writeFile(mapPath, mapContent, "utf8");
	await writeFile(path.join(buildDirectory, "manifest.json"), JSON.stringify(createManifest(buildId, createdUtc, mapContent)), "utf8");
}

describe("private source-map manifest", () => {
	it("принимает bounded manifest и отклоняет traversal", () => {
		expect(parsePrivateSourceMapManifest(createManifest())).toMatchObject({ application: APPLICATION, buildId: BUILD_ID });
		expect(
			parsePrivateSourceMapManifest({
				...createManifest(),
				entries: [{ ...createManifest().entries[0], map: "client/../secret.map" }]
			})
		).toBeNull();
	});

	it("не проходит через symlink build directory за private root", async () => {
		const root = path.join(tmpdir(), `error-report-artifact-${randomUUID()}`);
		const outside = path.join(tmpdir(), `error-report-outside-${randomUUID()}`);
		temporaryDirectories.push(root, outside);
		await mkdir(path.join(root, APPLICATION), { recursive: true });
		await mkdir(outside, { recursive: true });
		await writeFile(path.join(outside, "manifest.json"), JSON.stringify(createManifest()), "utf8");
		await symlink(outside, path.join(root, APPLICATION, BUILD_ID), "dir");

		await expect(loadPrivateSourceMapArtifact(root, APPLICATION, BUILD_ID)).rejects.toBeInstanceOf(PrivateSourceMapArtifactError);
	});
});

describe("private source-map build и runtime", () => {
	it("упаковывает client/server maps и удаляет их из public output", async () => {
		const base = path.join(tmpdir(), `error-report-build-${randomUUID()}`);
		const outputRoot = path.join(base, ".output");
		const artifactRoot = path.join(base, "private");
		temporaryDirectories.push(base);
		for (const bundle of ["public/static/app.js", "server/index.mjs"] as const) {
			const bundlePath = path.join(outputRoot, bundle);
			await mkdir(path.dirname(bundlePath), { recursive: true });
			await writeFile(bundlePath, "globalThis.app=true;\n//# sourceMappingURL=app.js.map\n", "utf8");
			await writeFile(`${bundlePath}.map`, bundle.startsWith("server/") ? SOURCE_MAP_WITHOUT_SOURCES_CONTENT : SOURCE_MAP, "utf8");
		}
		const dependencyRoot = path.join(outputRoot, "server/node_modules");
		await mkdir(dependencyRoot, { recursive: true });
		await symlink(path.join(base, "package-store"), path.join(dependencyRoot, "package"));
		expect(await stageClientSourceMapsForNitro(outputRoot)).toBe(1);
		const manifest = await packageErrorReportSourceMaps({ outputRoot, artifactRoot, application: APPLICATION, buildId: BUILD_ID });

		expect(manifest.entries.map((entry) => entry.bundle)).toEqual(["/static/app.js", "server/index.mjs"]);
		expect(await readFile(path.join(outputRoot, "public/static/app.js"), "utf8")).not.toContain("sourceMappingURL");
		await expect(readFile(path.join(outputRoot, "public/static/app.js.map"))).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("переносит client maps из отдельного Nitro v2 output в общий staging", async () => {
		const base = path.join(tmpdir(), `error-report-staging-${randomUUID()}`);
		const outputRoot = path.join(base, ".output");
		const publicRoot = path.join(base, "dist/client");
		const stagingRoot = path.join(base, ".source-map-staging/client");
		const artifactRoot = path.join(base, "private");
		temporaryDirectories.push(base);
		await mkdir(path.join(publicRoot, "static"), { recursive: true });
		await writeFile(path.join(publicRoot, "static/app.js"), "globalThis.app=true;\n//# sourceMappingURL=app.js.map\n", "utf8");
		await writeFile(path.join(publicRoot, "static/app.js.map"), SOURCE_MAP, "utf8");
		await mkdir(path.join(outputRoot, "public"), { recursive: true });
		await mkdir(path.join(outputRoot, "server"), { recursive: true });
		await writeFile(path.join(outputRoot, "server/index.mjs"), "globalThis.server=true;", "utf8");
		await writeFile(path.join(outputRoot, "server/index.mjs.map"), SOURCE_MAP_WITHOUT_SOURCES_CONTENT, "utf8");

		await expect(stageClientSourceMapsForNitro(outputRoot, { publicRoot, clientSourceMapStagingRoot: stagingRoot })).resolves.toBe(1);
		await expect(readFile(path.join(publicRoot, "static/app.js.map"))).rejects.toMatchObject({ code: "ENOENT" });
		await expect(readFile(path.join(stagingRoot, "static/app.js.map"), "utf8")).resolves.toBe(SOURCE_MAP);
		const manifest = await packageErrorReportSourceMaps({
			outputRoot,
			artifactRoot,
			clientSourceMapStagingRoot: stagingRoot,
			application: APPLICATION,
			buildId: BUILD_ID
		});
		expect(manifest.entries.map((entry) => entry.bundle)).toEqual(["/static/app.js", "server/index.mjs"]);
	});

	it("символизирует Chromium, Safari и server frames без host path", async () => {
		const root = path.join(tmpdir(), `error-report-symbolication-${randomUUID()}`);
		temporaryDirectories.push(root);
		await writeArtifact(root);
		const result = await symbolicateErrorReportStack(
			APPLICATION,
			BUILD_ID,
			[
				"TypeError: test",
				"    at minified (https://example.test/static/app.js:1:1)",
				"minified@https://example.test/static/app.js:1:1"
			].join("\n"),
			{ artifactRoots: [root] }
		);

		expect(result.status).toBe("resolved");
		expect(result.frames?.[0]?.original).toMatchObject({ source: "src/example.ts", line: 1, column: 1, name: "explode" });
		expect(result.stackTrace).toContain("src/example.ts:1:1");
		expect(result.stackTrace).not.toContain(tmpdir());
	});

	it("устанавливает current seed и удаляет старый валидный artifact", async () => {
		const base = path.join(tmpdir(), `error-report-archive-${randomUUID()}`);
		const seedRoot = path.join(base, "seed");
		const archiveRoot = path.join(base, "archive");
		temporaryDirectories.push(base);
		await writeArtifact(seedRoot);
		await writeArtifact(archiveRoot, OLD_BUILD_ID, "2026-06-01T00:00:00.000Z");

		await maintainPrivateSourceMapArchive({
			archiveRoot,
			seedRoot,
			application: APPLICATION,
			buildId: BUILD_ID,
			now: () => new Date("2026-09-10T00:00:00.000Z")
		});

		const current = await loadPrivateSourceMapArtifact(archiveRoot, APPLICATION, BUILD_ID);
		expect(current && (await readPrivateSourceMap(current, current.manifest.entries[0]!))).toBe(SOURCE_MAP);
		await expect(loadPrivateSourceMapArtifact(archiveRoot, APPLICATION, OLD_BUILD_ID)).resolves.toBeNull();
	});
});
