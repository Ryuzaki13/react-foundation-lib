import { describe, expect, it } from "vitest";

import { runTableFormulaV2PrecompilePerf } from "./perf.runtime";

describe("table formula runtime perf", () => {
	it("сравнивает v2 runtime до/после предкомпиляции и печатает метрики", () => {
		const result = runTableFormulaV2PrecompilePerf({
			iterations: 200_000,
			warmupIterations: 40_000,
			rounds: 4
		});

		console.info(
			[
				`[formulas v2 precompile perf] iterations=${result.iterations}, warmup=${result.warmupIterations}, rounds=${result.rounds}`,
				`[formulas v2 precompile perf] perCall: total=${result.perCall.totalMs.toFixed(2)}ms, ns/op=${result.perCall.nsPerOp.toFixed(2)}, checksum=${result.perCall.checksum.toFixed(4)}`,
				`[formulas v2 precompile perf] precompiled: total=${result.precompiled.totalMs.toFixed(2)}ms, ns/op=${result.precompiled.nsPerOp.toFixed(2)}, checksum=${result.precompiled.checksum.toFixed(4)}`,
				`[formulas v2 precompile perf] ratio precompiled/perCall: ${result.ratioPrecompiledToPerCall.toFixed(3)}`,
				`[formulas v2 precompile perf] speedup: x${result.speedup.toFixed(3)}`
			].join("\n")
		);

		expect(result.perCall.nsPerOp).toBeGreaterThan(0);
		expect(result.precompiled.nsPerOp).toBeGreaterThan(0);
		expect(result.perCall.checksum).toBeCloseTo(result.precompiled.checksum, 6);
	});
});
