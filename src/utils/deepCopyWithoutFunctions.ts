import { isPlainObject } from "../validators/isRecord";

type CopyFunctionStrategy = "omit" | "undefined";

type CopyOptions = {
	arrayFunctionStrategy?: CopyFunctionStrategy;
};

type DeepCopyWithoutFunctions<T> = T extends (...args: never[]) => unknown
	? never
	: T extends Date
		? Date
		: T extends readonly (infer Item)[]
			? DeepCopyWithoutFunctions<Item>[]
			: T extends object
				? {
						[K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: DeepCopyWithoutFunctions<T[K]>;
					}
				: T;

const SKIP_CLONE_VALUE = Symbol("SKIP_CLONE_VALUE");

export function deepCopyWithoutFunctions<T>(value: T, options: CopyOptions = {}): DeepCopyWithoutFunctions<T> {
	const arrayFunctionStrategy = options.arrayFunctionStrategy ?? "omit";
	const seen = new WeakMap<object, unknown>();

	const clone = (input: unknown): unknown => {
		if (typeof input === "function") {
			return SKIP_CLONE_VALUE;
		}

		if (input === null || typeof input !== "object") {
			return input;
		}

		const cached = seen.get(input);

		if (cached !== undefined) {
			return cached;
		}

		if (input instanceof Date) {
			return new Date(input.getTime());
		}

		if (Array.isArray(input)) {
			const result: unknown[] = [];
			seen.set(input, result);

			for (let index = 0; index < input.length; index += 1) {
				const clonedItem = clone(input[index]);

				if (clonedItem === SKIP_CLONE_VALUE) {
					if (arrayFunctionStrategy === "undefined") {
						result[index] = undefined;
					}

					continue;
				}

				if (arrayFunctionStrategy === "omit") {
					result.push(clonedItem);
				} else {
					result[index] = clonedItem;
				}
			}

			if (arrayFunctionStrategy === "undefined") {
				result.length = input.length;
			}

			return result;
		}

		if (!isPlainObject(input)) {
			throw new TypeError(`Unsupported object for config clone: ${Object.prototype.toString.call(input)}`);
		}

		const result: Record<string, unknown> = {};
		seen.set(input, result);

		for (const key of Object.keys(input)) {
			const clonedValue = clone(input[key]);

			if (clonedValue !== SKIP_CLONE_VALUE) {
				result[key] = clonedValue;
			}
		}

		return result;
	};

	const result = clone(value);

	if (result === SKIP_CLONE_VALUE) {
		return undefined as DeepCopyWithoutFunctions<T>;
	}

	return result as DeepCopyWithoutFunctions<T>;
}
