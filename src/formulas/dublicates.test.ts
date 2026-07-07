import { describe, expect, it } from "vitest";

import { createTableFormulaContext } from "./execute";
import { getTableFormulaList } from "./registry";
import { validateTableFormulaDependencies } from "./validate";

import type { TableFormulaDefinition } from "./types";

type FormulaSampleValue = string | number | Date | boolean | null | undefined;

const SAMPLE_SEED_COUNT = 10;
const MAX_FORMULA_ARGUMENTS = 8;
const FORMULA_DUPLICATE_ALLOWLIST = new Set<string>();
const sampleTypes = ["number", "string", "date", "boolean", "null", "undefined"] as const;

function createFormulaPairKey(leftId: string, rightId: string): string {
	return [leftId, rightId].sort().join("::");
}

function getRequiredDependencyCount(formulaId: string): number {
	const dependencies = Array.from({ length: MAX_FORMULA_ARGUMENTS }, (_, index) => `ARG_${index}`);
	const result = validateTableFormulaDependencies({
		formulaId,
		dependencies,
		availableColumnIds: dependencies
	});

	return result.usage.requiredDependencyCount;
}

function createStableValue(index: number): number {
	return (index + 2) * 17;
}

function createTypedValue(type: (typeof sampleTypes)[number], seed: number, index: number): FormulaSampleValue {
	switch (type) {
		case "number":
			return [0, 1, -1, 2.5, -2.5, 10, -10, 100, -100, 0.125][seed % SAMPLE_SEED_COUNT] + index;
		case "string":
			return ["0", "1", "-1", "2.5", "text", "", "0010", "NaN", "Infinity", "2026-01-01"][seed % SAMPLE_SEED_COUNT];
		case "date":
			return new Date(Date.UTC(2026, seed % 12, index + 1));
		case "boolean":
			return seed % 2 === 0;
		case "null":
			return null;
		case "undefined":
			return undefined;
	}
}

function createRowData(values: readonly FormulaSampleValue[]): Record<string, FormulaSampleValue> {
	return values.reduce<Record<string, FormulaSampleValue>>((acc, value, index) => {
		acc[`ARG_${index}`] = value;
		return acc;
	}, {});
}

function createSampleRows(argumentCount: number): Record<string, FormulaSampleValue>[] {
	if (argumentCount === 0) {
		return [{}];
	}

	const rows: Record<string, FormulaSampleValue>[] = [];

	for (const type of sampleTypes) {
		for (let seed = 0; seed < SAMPLE_SEED_COUNT; seed += 1) {
			for (let leftIndex = 0; leftIndex < argumentCount; leftIndex += 1) {
				for (let rightIndex = leftIndex; rightIndex < argumentCount; rightIndex += 1) {
					const values = Array.from<unknown, FormulaSampleValue>({ length: argumentCount }, (_, index) =>
						createStableValue(index)
					);
					values[leftIndex] = createTypedValue(type, seed, leftIndex);
					values[rightIndex] = createTypedValue(type, (seed + 3) % SAMPLE_SEED_COUNT, rightIndex);
					rows.push(createRowData(values));
				}
			}
		}
	}

	for (let seed = 0; seed < SAMPLE_SEED_COUNT; seed += 1) {
		const values = Array.from({ length: argumentCount }, (_, index) => {
			const type = sampleTypes[(seed + index) % sampleTypes.length];
			return createTypedValue(type!, seed, index);
		});
		rows.push(createRowData(values));
	}

	return rows;
}

function normalizeFormulaResult(result: unknown): string {
	if (typeof result === "number") {
		if (Number.isNaN(result)) return "number:NaN";
		if (result === Infinity) return "number:Infinity";
		if (result === -Infinity) return "number:-Infinity";
		return `number:${Number(result.toFixed(10))}`;
	}

	if (result instanceof Date) {
		return `date:${result.toISOString()}`;
	}

	return `${typeof result}:${String(result)}`;
}

function createBehaviorFingerprint(formula: TableFormulaDefinition, argumentCount: number): string {
	const keys = Array.from({ length: argumentCount }, (_, index) => `ARG_${index}`);

	return createSampleRows(argumentCount)
		.map((rowData) => {
			try {
				const context = createTableFormulaContext({ rowData, keys });
				return normalizeFormulaResult(formula.fn(context));
			} catch (error) {
				return `throw:${error instanceof Error ? error.name : typeof error}`;
			}
		})
		.join("|");
}

describe("table formulas duplicate detection", () => {
	it("не содержит формулы с одинаковым поведением на широком наборе тестовых данных", () => {
		const formulas = getTableFormulaList();
		const formulasByFingerprint = new Map<string, string[]>();

		for (const formula of formulas) {
			const argumentCount = getRequiredDependencyCount(formula.id);
			const fingerprint = `${argumentCount}:${createBehaviorFingerprint(formula, argumentCount)}`;
			formulasByFingerprint.set(fingerprint, [...(formulasByFingerprint.get(fingerprint) ?? []), formula.id]);
		}

		const duplicatePairs = [...formulasByFingerprint.values()]
			.filter((formulaIds) => formulaIds.length > 1)
			.flatMap((formulaIds) =>
				formulaIds.flatMap((formulaId, index) =>
					formulaIds.slice(index + 1).map((rightFormulaId) => createFormulaPairKey(formulaId, rightFormulaId))
				)
			)
			.filter((pairKey) => !FORMULA_DUPLICATE_ALLOWLIST.has(pairKey));

		expect(duplicatePairs).toEqual([]);
	});
});
