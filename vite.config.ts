import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

type PackageJson = {
	readonly peerDependencies?: Record<string, string>;
	readonly devDependencies?: Record<string, string>;
};

const packageJson = require("./package.json") as PackageJson;

const externalPackages = Object.keys(packageJson.peerDependencies ?? {});
const missingPeerDevDependencies = externalPackages.filter((packageName) => !packageJson.devDependencies?.[packageName]);

if (missingPeerDevDependencies.length > 0) {
	throw new Error(`Peer dependencies must also be present in devDependencies for local build: ${missingPeerDevDependencies.join(", ")}`);
}

function isExternalPackage(id: string): boolean {
	return externalPackages.some((packageName) => id === packageName || id.startsWith(`${packageName}/`));
}

function collectEntries(): Record<string, string> {
	const sourceRoot = resolve("src");
	const entries: Record<string, string> = {
		"pwa/sw-cache-policy": resolve(sourceRoot, "pwa/swCachePolicy.ts")
	};

	for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const filePath = resolve(sourceRoot, entry.name, "index.ts");
		if (!existsSync(filePath)) continue;

		entries[`${entry.name}/index`] = filePath;
	}

	return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)));
}

function createDefine(configEnv: { mode: string }): Record<string, string> {
	if (configEnv.mode !== "test" && process.env.VITEST !== "true") {
		return {};
	}

	return {
		__APP_BUILD_ID__: "undefined",
		__APP_ID__: JSON.stringify("react-foundation-lib-test"),
		__DEV__: "true",
		__PREVIEW__: "false",
		__REACT_QUERY_PERSISTENCE_BUSTER__: JSON.stringify("react-foundation-lib-query-test"),
		__SERVICE_WORKER_SCOPE__: JSON.stringify("/arm/"),
		__SERVICE_WORKER_URL__: JSON.stringify("/arm/sw.js"),
		__SERVICE_WORKER_UPDATE_RELOAD_COUNT_KEY__: JSON.stringify("react-foundation-lib-test.service-worker.update-reload-count.v1"),
		__SERVICE_WORKER_MAX_AUTO_UPDATE_RELOADS__: "5"
	};
}

export default defineConfig((configEnv) => ({
	define: createDefine(configEnv),
	build: {
		target: "es2022",
		sourcemap: true,
		emptyOutDir: true,
		copyPublicDir: false,
		lib: {
			entry: collectEntries(),
			formats: ["es"]
		},
		rollupOptions: {
			external: isExternalPackage,
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "chunks/[name]-[hash].js",
				assetFileNames: "assets/[name][extname]"
			}
		}
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"]
	}
}));
