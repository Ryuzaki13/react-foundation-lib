import type { State } from "../../types";

/**
 * К какому сегменту относится пороговое значение:
 * - `"lower"` — пороговое значение включено в нижний сегмент (`≤`)
 * - `"upper"` — пороговое значение включено в верхний сегмент (`≥`)
 */
export type ThresholdBoundary = "lower" | "upper";

/** Расширенное определение порога с настройкой включения границы */
export interface ThresholdDefinition {
	value: number;
	/** К какому сегменту относится пороговое значение. По умолчанию — `"upper"` */
	boundary?: ThresholdBoundary;
}

/** Конфигурация порогового резолвера состояний */
export interface ThresholdValueStateResolverConfig {
	/** Пороговые значения. Можно передать число или объект с настройкой границы */
	thresholds: Array<number | ThresholdDefinition>;
	/** Состояния для каждого сегмента. Количество должно быть `thresholds.length + 1` */
	states: State[];
	/** Состояние для невалидных значений (NaN, Infinity, не число). По умолчанию `"none"` */
	invalidState?: State;
}

/** Конфигурация фиксированного резолвера состояний */
export interface FixedValueStateResolverConfig {
	/**
	 * Маппинг: конкретное значение → State.
	 * Ключи — строковые представления значений ячеек.
	 */
	entries: Record<string, State>;
	/** Состояние по умолчанию для значений, не попавших в маппинг. По умолчанию `"none"` */
	fallbackState?: State;
}

/** Функция-резолвер: принимает значение, возвращает State */
export type ValueStateResolver = (value: unknown) => State;
