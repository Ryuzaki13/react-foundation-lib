import { NumberScaleBounds, NumberScaleMark, NumberScaleMarksPosition, NumberScaleOptions } from "./types";

function countFractionDigits(value: number) {
	if (!Number.isFinite(value)) {
		return 0;
	}

	const normalized = value.toString().toLowerCase();
	const exponentIndex = normalized.indexOf("e-");
	if (exponentIndex >= 0) {
		return Number(normalized.slice(exponentIndex + 2));
	}

	const dotIndex = normalized.indexOf(".");
	return dotIndex >= 0 ? normalized.length - dotIndex - 1 : 0;
}

function roundWithPrecision(value: number, precision: number) {
	if (precision <= 0) {
		return Math.round(value);
	}

	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
}

/**
 * Возвращает безопасные границы числовой шкалы и меняет их местами, если min больше max.
 */
export function resolveNumberScaleBounds(min: number, max: number): NumberScaleBounds {
	if (!Number.isFinite(min) || !Number.isFinite(max)) {
		return { min: 0, max: 100 };
	}

	return min <= max ? { min, max } : { min: max, max: min };
}

/**
 * Ограничивает значение конечными границами шкалы.
 */
export function clampNumberScaleValue(value: number, min: number, max: number) {
	if (!Number.isFinite(value)) {
		return min;
	}

	return Math.min(max, Math.max(min, value));
}

/**
 * Нормализует шаг шкалы: некорректные, нулевые и отрицательные значения заменяет на 1.
 */
export function normalizeNumberScaleStep(step?: number) {
	if (!Number.isFinite(step) || step === undefined || step <= 0) {
		return 1;
	}

	return step;
}

/**
 * Фильтрует, сортирует и дедуплицирует marks по finite value внутри границ шкалы.
 */
export function prepareNumberScaleMarks<TMark extends NumberScaleMark>(
	marks: readonly TMark[] | undefined,
	min: number,
	max: number
): TMark[] {
	if (!marks?.length) {
		return [];
	}

	const seen = new Set<number>();

	return marks
		.filter((mark) => Number.isFinite(mark.value) && mark.value >= min && mark.value <= max)
		.slice()
		.sort((left, right) => left.value - right.value)
		.filter((mark) => {
			if (seen.has(mark.value)) {
				return false;
			}

			seen.add(mark.value);
			return true;
		});
}

/**
 * Привязывает значение к ближайшему шагу с учётом десятичной точности min/max/step.
 */
export function snapNumberScaleValueToStep(value: number, min: number, max: number, step?: number) {
	const normalizedStep = normalizeNumberScaleStep(step);
	const clamped = clampNumberScaleValue(value, min, max);
	const precision = Math.max(countFractionDigits(normalizedStep), countFractionDigits(min), countFractionDigits(max));
	const snapped = min + Math.round((clamped - min) / normalizedStep) * normalizedStep;

	return clampNumberScaleValue(roundWithPrecision(snapped, precision), min, max);
}

/**
 * Возвращает ближайший mark по числовому value.
 */
export function findClosestNumberScaleMark<TMark extends NumberScaleMark>(value: number, marks: readonly TMark[]) {
	if (!marks.length) {
		return undefined;
	}

	let nearest = marks[0];
	let distance = Math.abs(value - nearest.value);

	for (let index = 1; index < marks.length; index += 1) {
		const mark = marks[index];
		const nextDistance = Math.abs(value - mark.value);

		if (nextDistance < distance) {
			nearest = mark;
			distance = nextDistance;
		}
	}

	return nearest;
}

/**
 * Привязывает значение к value ближайшего mark.
 */
export function snapNumberScaleValueToMarks<TMark extends NumberScaleMark>(
	value: number,
	marks: readonly TMark[],
	min: number,
	max: number
) {
	if (!marks.length) {
		return clampNumberScaleValue(value, min, max);
	}

	const clamped = clampNumberScaleValue(value, min, max);
	return findClosestNumberScaleMark(clamped, marks)?.value ?? clamped;
}

/**
 * Привязывает значение к marks, если они есть, иначе к step.
 */
export function snapNumberScaleValue<TMark extends NumberScaleMark>(value: number, options: NumberScaleOptions<TMark>) {
	const { min, max } = resolveNumberScaleBounds(options.min, options.max);
	const preparedMarks = prepareNumberScaleMarks(options.marks, min, max);

	if (preparedMarks.length > 0) {
		return snapNumberScaleValueToMarks(value, preparedMarks, min, max);
	}

	return snapNumberScaleValueToStep(value, min, max, options.step);
}

export function valueToNumberScalePercent(value: number, min: number, max: number) {
	if (max <= min) {
		return 0;
	}

	return ((clampNumberScaleValue(value, min, max) - min) / (max - min)) * 100;
}

export function percentToNumberScaleValue(percent: number, min: number, max: number) {
	if (max <= min) {
		return min;
	}

	const safePercent = clampNumberScaleValue(percent, 0, 100);
	return min + ((max - min) * safePercent) / 100;
}

/**
 * Возвращает позицию mark в процентах: по числовому value или равномерно по индексу.
 */
export function getNumberScaleMarkPercent(
	markIndex: number,
	marks: readonly NumberScaleMark[],
	min: number,
	max: number,
	marksPosition: NumberScaleMarksPosition = "value"
) {
	if (marksPosition === "index" && marks.length > 1) {
		return (markIndex / (marks.length - 1)) * 100;
	}

	if (marksPosition === "index") {
		return 0;
	}

	return valueToNumberScalePercent(marks[markIndex]?.value ?? min, min, max);
}

/**
 * Находит ближайший mark по визуальной позиции процента.
 */
export function findClosestNumberScaleMarkByPercent<TMark extends NumberScaleMark>(
	percent: number,
	marks: readonly TMark[],
	min: number,
	max: number,
	marksPosition: NumberScaleMarksPosition = "value"
) {
	if (!marks.length) {
		return undefined;
	}

	const safePercent = clampNumberScaleValue(percent, 0, 100);
	let nearest = marks[0];
	let distance = Math.abs(safePercent - getNumberScaleMarkPercent(0, marks, min, max, marksPosition));

	for (let index = 1; index < marks.length; index += 1) {
		const nextDistance = Math.abs(safePercent - getNumberScaleMarkPercent(index, marks, min, max, marksPosition));

		if (nextDistance < distance) {
			nearest = marks[index];
			distance = nextDistance;
		}
	}

	return nearest;
}

/**
 * Преобразует pointer percent в значение шкалы с учётом равномерного позиционирования marks.
 */
export function percentToSnappedNumberScaleValue<TMark extends NumberScaleMark>(percent: number, options: NumberScaleOptions<TMark>) {
	const { min, max } = resolveNumberScaleBounds(options.min, options.max);
	const preparedMarks = prepareNumberScaleMarks(options.marks, min, max);

	if (preparedMarks.length > 0) {
		const closestMark = findClosestNumberScaleMarkByPercent(percent, preparedMarks, min, max, options.marksPosition);
		return closestMark?.value ?? min;
	}

	return snapNumberScaleValueToStep(percentToNumberScaleValue(percent, min, max), min, max, options.step);
}

/**
 * Смещает значение на offset шагов или на offset marks.
 */
export function offsetNumberScaleValue<TMark extends NumberScaleMark>(
	currentValue: number,
	offset: number,
	options: NumberScaleOptions<TMark>,
	lowerBound = options.min,
	upperBound = options.max
) {
	const { min, max } = resolveNumberScaleBounds(lowerBound, upperBound);
	const preparedMarks = prepareNumberScaleMarks(options.marks, min, max);

	if (preparedMarks.length > 0) {
		const values = preparedMarks.map((mark) => mark.value);
		let nearestIndex = 0;
		let nearestDistance = Math.abs(currentValue - values[0]);

		for (let index = 1; index < values.length; index += 1) {
			const nextDistance = Math.abs(currentValue - values[index]);
			if (nextDistance < nearestDistance) {
				nearestDistance = nextDistance;
				nearestIndex = index;
			}
		}

		const nextIndex = clampNumberScaleValue(nearestIndex + offset, 0, values.length - 1);
		return values[nextIndex];
	}

	const normalizedStep = normalizeNumberScaleStep(options.step);
	return snapNumberScaleValueToStep(currentValue + offset * normalizedStep, min, max, normalizedStep);
}
