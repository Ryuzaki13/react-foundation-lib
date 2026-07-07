/**
 * Режим расчёта визуальных позиций marks.
 * `value` использует числовую пропорцию, `index` расставляет marks равномерно.
 */
export type NumberScaleMarksPosition = "value" | "index";

export interface NumberScaleMark {
	/**
	 * Координата mark на внутренней числовой шкале.
	 */
	value: number;
}

export interface NumberScaleOptions<TMark extends NumberScaleMark = NumberScaleMark> {
	/**
	 * Минимальная координата шкалы.
	 */
	min: number;
	/**
	 * Максимальная координата шкалы.
	 */
	max: number;
	/**
	 * Шаг snap-логики, используется если нет marks.
	 */
	step?: number;
	/**
	 * Дискретные точки шкалы, к которым snap-ится значение.
	 */
	marks?: readonly TMark[];
	/**
	 * Режим размещения marks на track.
	 */
	marksPosition?: NumberScaleMarksPosition;
}

export interface NumberScaleBounds {
	/**
	 * Нормализованная минимальная координата.
	 */
	min: number;
	/**
	 * Нормализованная максимальная координата.
	 */
	max: number;
}
