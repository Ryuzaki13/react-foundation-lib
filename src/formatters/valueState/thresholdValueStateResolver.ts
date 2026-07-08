import { State } from "../../types";

import { ThresholdBoundary, ThresholdDefinition, ThresholdValueStateResolverConfig, ValueStateResolver } from "./types";
import { findResolverByCanonicalKey, registerResolver } from "./valueStateRegistry";

/**
 * Нормализованный порог (внутренний тип)
 */
interface NormalizedThreshold {
	value: number;
	boundary: ThresholdBoundary;
}

/** Нормализовать порог: число → объект с boundary по умолчанию */
function normalizeThreshold(threshold: number | ThresholdDefinition): NormalizedThreshold {
	if (typeof threshold === "number") {
		return { value: threshold, boundary: "upper" };
	}
	return { value: threshold.value, boundary: threshold.boundary ?? "upper" };
}

/** Создать каноническую строку конфигурации (с префиксом типа для изоляции от других резолверов) */
function createCanonicalKey(sortedThresholds: NormalizedThreshold[], states: State[], invalidState: State): string {
	const thresholdsPart = sortedThresholds.map((t) => `${t.value}:${t.boundary}`).join(",");
	return `threshold|${thresholdsPart}|${states.join(",")}|${invalidState}`;
}

/** Валидация конфигурации */
function validateConfig(thresholds: NormalizedThreshold[], states: State[]): void {
	if (states.length !== thresholds.length + 1) {
		throw new Error(`Количество состояний (${states.length}) должно быть равно количеству порогов + 1 (${thresholds.length + 1})`);
	}

	const seen = new Set<number>();
	for (const threshold of thresholds) {
		if (seen.has(threshold.value)) {
			console.warn(`Дублирующееся пороговое значение: ${threshold.value}`);
		}
		seen.add(threshold.value);
	}
}

/** Скомпилировать функцию-резолвер из нормализованных данных */
function compileThresholdResolver(sortedThresholds: NormalizedThreshold[], configStates: State[], invalidState: State): ValueStateResolver {
	const thresholdValues = sortedThresholds.map((t) => t.value);
	const thresholdIsLower = sortedThresholds.map((t) => t.boundary === "lower");
	const states = [...configStates];

	return (value: unknown): State => {
		if (value === "" || value === null || value === undefined) return invalidState;

		const numericValue = +(value as number);

		if (!Number.isFinite(numericValue)) return invalidState;

		for (let i = 0; i < thresholdValues.length; i++) {
			const belongsToLowerSegment = thresholdIsLower[i] ? numericValue <= thresholdValues[i] : numericValue < thresholdValues[i];

			if (belongsToLowerSegment) return states[i];
		}

		return states[states.length - 1];
	};
}

/** Нормализовать конфигурацию и вернуть подготовленные данные */
function prepareConfig(config: ThresholdValueStateResolverConfig) {
	const invalidState: State = config.invalidState ?? "none";
	const sortedThresholds = config.thresholds.map(normalizeThreshold).sort((a, b) => a.value - b.value);

	validateConfig(sortedThresholds, config.states);

	const canonicalKey = createCanonicalKey(sortedThresholds, config.states, invalidState);

	return { sortedThresholds, invalidState, canonicalKey, states: config.states };
}

/**
 * Зарегистрировать пороговый резолвер из конфигурации.
 * Возвращает короткий уникальный `id` для использования в столбцах таблицы.
 *
 * Идентичные конфигурации (даже с разным порядком порогов)
 * возвращают один и тот же `id` — функция дедуплицирует по содержимому.
 *
 * @example
 * ```ts
 * const id = registerThresholdResolver({
 *   thresholds: [60, 95],
 *   states: ["warning", "success", "error"],
 * });
 * // id → "v_1a2b3c4"
 *
 * // В ячейке: resolveValueState(id, cellValue)
 * ```
 */
export function registerThresholdResolver(config: ThresholdValueStateResolverConfig): string {
	const { sortedThresholds, invalidState, canonicalKey, states } = prepareConfig(config);

	const { id } = registerResolver(canonicalKey, () => compileThresholdResolver(sortedThresholds, states, invalidState));

	return id;
}

/**
 * Создать функцию-резолвер напрямую.
 * Резолвер регистрируется в общем реестре.
 * Идентичные конфигурации возвращают одну и ту же функцию.
 *
 * @example
 * ```ts
 * const resolve = createThresholdResolver({
 *   thresholds: [60, 95],
 *   states: ["warning", "success", "error"],
 * });
 *
 * resolve(45);    // → "warning"
 * resolve(75);    // → "success"
 * resolve(100);   // → "error"
 * resolve("abc"); // → "none"
 * ```
 */
export function createThresholdResolver(config: ThresholdValueStateResolverConfig): ValueStateResolver {
	const { sortedThresholds, invalidState, canonicalKey, states } = prepareConfig(config);

	const existing = findResolverByCanonicalKey(canonicalKey);
	if (existing) return existing;

	registerResolver(canonicalKey, () => compileThresholdResolver(sortedThresholds, states, invalidState));

	return findResolverByCanonicalKey(canonicalKey)!;
}
