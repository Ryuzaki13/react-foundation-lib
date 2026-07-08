type DeepCloneOptions = {
	/**
	 * undefined — сохраняет длину массива и индексную структуру.
	 * omit — удаляет элементы-функции из массива.
	 */
	arrayFunctionStrategy?: "undefined" | "omit";

	/**
	 * false — возвращает plain object.
	 * true — сохраняет prototype исходного объекта.
	 *
	 * Для Zustand-состояния обычно лучше false.
	 */
	preservePrototype?: boolean;
};

type DeepCloneWithoutFunctions<T> = T extends (...args: infer _Args) => unknown
	? never
	: T extends Date
		? Date
		: T extends RegExp
			? RegExp
			: T extends Map<infer K, infer V>
				? Map<DeepCloneWithoutFunctions<K>, DeepCloneWithoutFunctions<V>>
				: T extends Set<infer V>
					? Set<DeepCloneWithoutFunctions<V>>
					: T extends readonly (infer Item)[]
						? DeepCloneWithoutFunctions<Item>[]
						: T extends object
							? {
									[K in keyof T as T[K] extends (...args: infer _Args) => unknown ? never : K]: DeepCloneWithoutFunctions<
										T[K]
									>;
								}
							: T;

const SKIP = Symbol("deep-copy-skip");

export function deepCloneWithoutFunctions<T>(value: T, options: DeepCloneOptions = {}): DeepCloneWithoutFunctions<T> {
	const seen = new WeakMap<object, unknown>();

	const clone = (input: unknown): unknown => {
		if (typeof input === "function") {
			return SKIP;
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

		if (input instanceof RegExp) {
			const result = new RegExp(input.source, input.flags);
			result.lastIndex = input.lastIndex;
			return result;
		}

		if (input instanceof Map) {
			const result = new Map<unknown, unknown>();
			seen.set(input, result);

			for (const [key, mapValue] of input) {
				const clonedKey = clone(key);
				const clonedValue = clone(mapValue);

				if (clonedKey !== SKIP && clonedValue !== SKIP) {
					result.set(clonedKey, clonedValue);
				}
			}

			return result;
		}

		if (input instanceof Set) {
			const result = new Set<unknown>();
			seen.set(input, result);

			for (const item of input) {
				const clonedItem = clone(item);

				if (clonedItem !== SKIP) {
					result.add(clonedItem);
				}
			}

			return result;
		}

		if (Array.isArray(input)) {
			const result: unknown[] = [];
			seen.set(input, result);

			for (let index = 0; index < input.length; index += 1) {
				if (!(index in input)) {
					continue;
				}

				const clonedItem = clone(input[index]);

				if (clonedItem === SKIP) {
					if (options.arrayFunctionStrategy === "omit") {
						continue;
					}

					result[index] = undefined;
					continue;
				}

				if (options.arrayFunctionStrategy === "omit") {
					result.push(clonedItem);
				} else {
					result[index] = clonedItem;
				}
			}

			if (options.arrayFunctionStrategy !== "omit") {
				result.length = input.length;
			}

			return result;
		}

		const prototype = options.preservePrototype ? Object.getPrototypeOf(input) : Object.prototype;

		const result = Object.create(prototype) as Record<PropertyKey, unknown>;
		seen.set(input, result);

		for (const key of Reflect.ownKeys(input)) {
			const descriptor = Object.getOwnPropertyDescriptor(input, key);

			if (!descriptor) {
				continue;
			}

			/**
			 * Getters/setters не вызываем.
			 * В Zustand-состоянии их лучше вообще не хранить.
			 */
			if (!("value" in descriptor)) {
				continue;
			}

			const clonedValue = clone(descriptor.value);

			if (clonedValue === SKIP) {
				continue;
			}

			Object.defineProperty(result, key, {
				...descriptor,
				value: clonedValue
			});
		}

		return result;
	};

	const result = clone(value);

	if (result === SKIP) {
		return undefined as DeepCloneWithoutFunctions<T>;
	}

	return result as DeepCloneWithoutFunctions<T>;
}
