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
	throw new Error(
		`Peer dependencies must also be present in devDependencies for local build: ${missingPeerDevDependencies.join(", ")}`
	);
}

function isExternalPackage(id: string): boolean {
	return externalPackages.some((packageName) => id === packageName || id.startsWith(`${packageName}/`));
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
			entry: {
					"array/index": resolve("src/array/index.ts"),
					"binary/index": resolve("src/binary/index.ts"),
					"bounded-copy-stack/index": resolve("src/bounded-copy-stack/index.ts"),
					"context-menu/index": resolve("src/context-menu/index.ts"),
					"copy/index": resolve("src/copy/index.ts"),
					"crypto/index": resolve("src/crypto/index.ts"),
					"currency/index": resolve("src/currency/index.ts"),
					"date-segments/index": resolve("src/date-segments/index.ts"),
					"dom/index": resolve("src/dom/index.ts"),
					"error/index": resolve("src/error/index.ts"),
					"error-report/index": resolve("src/error-report/index.ts"),
					"excel/index": resolve("src/excel/index.ts"),
					"file/index": resolve("src/file/index.ts"),
					"form/index": resolve("src/form/index.ts"),
					"formatters/index": resolve("src/formatters/index.ts"),
					"formulas/index": resolve("src/formulas/index.ts"),
					"hooks/index": resolve("src/hooks/index.ts"),
					"http/index": resolve("src/http/index.ts"),
					"media/index": resolve("src/media/index.ts"),
					"notifications/index": resolve("src/notifications/index.ts"),
					"number-scale/index": resolve("src/number-scale/index.ts"),
					"odata/index": resolve("src/odata/index.ts"),
					"odata-service/index": resolve("src/odata-service/index.ts"),
					"presets/index": resolve("src/presets/index.ts"),
					"pwa/index": resolve("src/pwa/index.ts"),
					"pwa/sw-cache-policy": resolve("src/pwa/swCachePolicy.ts"),
					"query-client/index": resolve("src/query-client/index.ts"),
					"range-output/index": resolve("src/range-output/index.ts"),
					"seo/index": resolve("src/seo/index.ts"),
					"session-storage/index": resolve("src/session-storage/index.ts"),
					"string-comparison/index": resolve("src/string-comparison/index.ts"),
					"table/index": resolve("src/table/index.ts"),
					"three-scene/index": resolve("src/three-scene/index.ts"),
					"tree-table/index": resolve("src/tree-table/index.ts"),
					"types/index": resolve("src/types/index.ts"),
					"utils/index": resolve("src/utils/index.ts"),
					"validators/index": resolve("src/validators/index.ts"),
					"virtualizer/index": resolve("src/virtualizer/index.ts"),
					"xml/index": resolve("src/xml/index.ts")
			},
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
