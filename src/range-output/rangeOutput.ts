import { isRecord } from "../validators";

import type { BaseType } from "../types";

export type RangeOutputValueFallback<TValue extends BaseType = BaseType> = {
	start?: TValue | null;
	end?: TValue | null;
};

export type RangeOutputFallbackEndpointParser<TValue extends BaseType> = (value: unknown) => TValue | null | undefined;

/**
 * Читает сериализуемые подстановки открытых границ из объекта с `outputValueFallback`.
 */
export function readRangeOutputValueFallback<TValue extends BaseType>(
	props: unknown,
	parseEndpoint: RangeOutputFallbackEndpointParser<TValue>
): RangeOutputValueFallback<TValue> | undefined {
	if (!isRecord(props)) {
		return undefined;
	}

	const rawFallback = props.outputValueFallback;
	if (!isRecord(rawFallback)) {
		return undefined;
	}

	const start = parseEndpoint(rawFallback.start);
	const end = parseEndpoint(rawFallback.end);

	if (start === undefined && end === undefined) {
		return undefined;
	}

	return {
		...(start !== undefined && { start }),
		...(end !== undefined && { end })
	};
}

function resolveRangeOutputEndpoint<TValue extends BaseType>(value: TValue | null, fallback: TValue | null | undefined) {
	if (value !== null) {
		return value;
	}

	return fallback ?? null;
}

/**
 * Возвращает range-значение для внешней сериализации, не меняя исходный UI-контракт с `null`.
 */
export function resolveRangeOutputValue<TValue extends BaseType>(
	value: readonly [TValue | null, TValue | null],
	fallback: RangeOutputValueFallback<TValue> | undefined
): [TValue | null, TValue | null] {
	if (!fallback) {
		return [value[0], value[1]];
	}

	return [resolveRangeOutputEndpoint(value[0], fallback.start), resolveRangeOutputEndpoint(value[1], fallback.end)];
}
