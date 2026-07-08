import { compileTableFormula, executeTableFormula } from "./execute";

import type { TableFormulaCompiledExecutor, TableFormulaExecutionResult } from "./execute";
import type { TableFormulaRowData } from "./types";

// npx vitest run src/shared/lib/formulas/perf.runtime.test.ts

export interface TableFormulaRuntimePerfResult {
	iterations: number;
	warmupIterations: number;
	rounds: number;
	v2: {
		totalMs: number;
		nsPerOp: number;
		checksum: number;
	};
}

export interface TableFormulaV2PrecompilePerfResult {
	iterations: number;
	warmupIterations: number;
	rounds: number;
	perCall: {
		totalMs: number;
		nsPerOp: number;
		checksum: number;
	};
	precompiled: {
		totalMs: number;
		nsPerOp: number;
		checksum: number;
	};
	ratioPrecompiledToPerCall: number;
	speedup: number;
}

type FormulaExecutor = (args: {
	formulaId: string | undefined;
	rowData: TableFormulaRowData;
	keys?: readonly string[];
}) => TableFormulaExecutionResult;

type MeasureResult = {
	totalMs: number;
	nsPerOp: number;
	checksum: number;
};

function nowMs(): number {
	if (typeof performance !== "undefined" && typeof performance.now === "function") {
		return performance.now();
	}

	return Date.now();
}

function runIterations(args: {
	executor: FormulaExecutor;
	iterations: number;
	keys: readonly string[];
	sampleRows: readonly TableFormulaRowData[];
}): number {
	let checksum = 0;
	const sampleRowsCount = args.sampleRows.length;

	for (let index = 0; index < args.iterations; index += 1) {
		const rowData = args.sampleRows[index % sampleRowsCount];
		const execution = args.executor({
			formulaId: "markup",
			rowData,
			keys: args.keys
		});

		checksum += execution.ok ? execution.value : 0;
	}

	return checksum;
}

function runCompiledIterations(args: {
	executor: TableFormulaCompiledExecutor;
	iterations: number;
	sampleRows: readonly TableFormulaRowData[];
}): number {
	let checksum = 0;
	const sampleRowsCount = args.sampleRows.length;

	for (let index = 0; index < args.iterations; index += 1) {
		const rowData = args.sampleRows[index % sampleRowsCount];
		const execution = args.executor(rowData);
		checksum += execution.ok ? execution.value : 0;
	}

	return checksum;
}

function measureExecutor(args: {
	executor: FormulaExecutor;
	iterations: number;
	warmupIterations: number;
	rounds: number;
	keys: readonly string[];
	sampleRows: readonly TableFormulaRowData[];
}): MeasureResult {
	if (args.warmupIterations > 0) {
		runIterations({
			executor: args.executor,
			iterations: args.warmupIterations,
			keys: args.keys,
			sampleRows: args.sampleRows
		});
	}

	let totalMs = 0;
	let checksum = 0;

	for (let round = 0; round < args.rounds; round += 1) {
		const startedAt = nowMs();
		checksum += runIterations({
			executor: args.executor,
			iterations: args.iterations,
			keys: args.keys,
			sampleRows: args.sampleRows
		});
		totalMs += nowMs() - startedAt;
	}

	const operationsCount = args.iterations * args.rounds;
	return {
		totalMs,
		nsPerOp: (totalMs * 1_000_000) / operationsCount,
		checksum
	};
}

function measureCompiledExecutor(args: {
	executor: TableFormulaCompiledExecutor;
	iterations: number;
	warmupIterations: number;
	rounds: number;
	sampleRows: readonly TableFormulaRowData[];
}): MeasureResult {
	if (args.warmupIterations > 0) {
		runCompiledIterations({
			executor: args.executor,
			iterations: args.warmupIterations,
			sampleRows: args.sampleRows
		});
	}

	let totalMs = 0;
	let checksum = 0;

	for (let round = 0; round < args.rounds; round += 1) {
		const startedAt = nowMs();
		checksum += runCompiledIterations({
			executor: args.executor,
			iterations: args.iterations,
			sampleRows: args.sampleRows
		});
		totalMs += nowMs() - startedAt;
	}

	const operationsCount = args.iterations * args.rounds;
	return {
		totalMs,
		nsPerOp: (totalMs * 1_000_000) / operationsCount,
		checksum
	};
}

/**
 * Бенчмарк runtime-выполнения формул для сравнения v1 и v2.
 * Важно: запускать несколько раз и сравнивать относительную разницу,
 * а не абсолютные числа на одном запуске.
 */
export function runTableFormulaRuntimePerf(args?: {
	iterations?: number;
	warmupIterations?: number;
	rounds?: number;
}): TableFormulaRuntimePerfResult {
	const iterations = Math.max(1, args?.iterations ?? 250_000);
	const warmupIterations = Math.max(0, args?.warmupIterations ?? 50_000);
	const rounds = Math.max(1, args?.rounds ?? 5);
	const keys = Object.freeze(["MP_BC", "NETWR"]);

	const sampleRows = Object.freeze<TableFormulaRowData[]>([
		{ MP_BC: 100, NETWR: 160 },
		{ MP_BC: 120, NETWR: 190 },
		{ MP_BC: 80, NETWR: 140 },
		{ MP_BC: 240, NETWR: 360 }
	]);

	const v2 = measureExecutor({
		executor: executeTableFormula,
		iterations,
		warmupIterations,
		rounds,
		keys,
		sampleRows
	});

	return {
		iterations,
		warmupIterations,
		rounds,
		v2
	};
}

/**
 * Сравнивает v2 runtime "до/после" предкомпиляции:
 * - `perCall`: executeTableFormulaV2 (компиляция при каждом вызове);
 * - `precompiled`: compileTableFormulaV2 один раз + вызов executor(rowData).
 */
export function runTableFormulaV2PrecompilePerf(args?: {
	iterations?: number;
	warmupIterations?: number;
	rounds?: number;
}): TableFormulaV2PrecompilePerfResult {
	const iterations = Math.max(1, args?.iterations ?? 250_000);
	const warmupIterations = Math.max(0, args?.warmupIterations ?? 50_000);
	const rounds = Math.max(1, args?.rounds ?? 5);
	const keys = Object.freeze(["MP_BC", "NETWR"]);

	const sampleRows = Object.freeze<TableFormulaRowData[]>([
		{ MP_BC: 100, NETWR: 160 },
		{ MP_BC: 120, NETWR: 190 },
		{ MP_BC: 80, NETWR: 140 },
		{ MP_BC: 240, NETWR: 360 }
	]);

	const perCall = measureExecutor({
		executor: executeTableFormula,
		iterations,
		warmupIterations,
		rounds,
		keys,
		sampleRows
	});

	const compiled = compileTableFormula({
		formulaId: "markup",
		keys
	});
	if (!compiled.ok) {
		throw new Error("Не удалось скомпилировать формулу markup для perf-теста");
	}

	const precompiled = measureCompiledExecutor({
		executor: compiled.execute,
		iterations,
		warmupIterations,
		rounds,
		sampleRows
	});

	return {
		iterations,
		warmupIterations,
		rounds,
		perCall,
		precompiled,
		ratioPrecompiledToPerCall: precompiled.nsPerOp / perCall.nsPerOp,
		speedup: perCall.nsPerOp / precompiled.nsPerOp
	};
}
