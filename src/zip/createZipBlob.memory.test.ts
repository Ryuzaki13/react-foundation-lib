import { describe, expect, it } from "vitest";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

describe("createZipBlob: освобождение исходных Blob", () => {
	it.each(["abort", "processed"])("освобождает ссылки при незавершённом чтении: %s", (scenario) => {
		// Отдельный runtime даёт управляемый GC, не меняя флаги Vitest и не
		// полагаясь на объём свободной памяти или эвристику сборщика мусора.
		const output = execFileSync(
			process.execPath,
			["--expose-gc", fileURLToPath(new URL("./zipMemory.fixture.test.mjs", import.meta.url)), scenario],
			{ encoding: "utf8", timeout: 10_000 }
		);

		expect(JSON.parse(output)).toEqual({ processedRetained: false, retainedAfterAbort: [false, false] });
	});
});
