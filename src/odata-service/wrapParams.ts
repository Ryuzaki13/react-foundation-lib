import { UnwrappedODataParameters, WrapODataParameters, WrappedODataParameters } from "./types";

// export function wrapODataParams(data: Record<string, unknown>): Record<string, ODataValue> {
// 	if (!data) return {};
// 	return Object.entries(data).reduce(
// 		(acc, [key, value]) => {
// 			// NOTE: пропускаем пустые строки и 0
// 			if (value != null) {
// 				acc[key] = { value };
// 			}
// 			return acc;
// 		},
// 		{} as Record<string, ODataValue>
// 	);
// }

/**
 * Типизированный хелпер для преобразования плоской структуры в wrapped.
 */
export function wrapODataParams<T extends UnwrappedODataParameters>(params: T | undefined | null): WrapODataParameters<T> {
	if (!params) return {} as WrapODataParameters<T>;

	const result = {} as WrapODataParameters<T>;
	for (const key in params) {
		result[key] = { value: params[key] };
	}

	return result;
}

export function unwrapODataParams(params?: WrappedODataParameters): UnwrappedODataParameters | undefined {
	if (!params) return undefined;

	const normalized: UnwrappedODataParameters = {};
	for (const key of Object.keys(params).sort()) {
		normalized[key] = params[key]?.value ?? null;
	}

	return normalized;
}
