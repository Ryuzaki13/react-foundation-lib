export function findFirstEnabledIndex<T>(options: readonly T[], getOptionDisabled?: (option: T) => boolean) {
	for (let index = 0; index < options.length; index += 1) {
		if (!getOptionDisabled?.(options[index])) {
			return index;
		}
	}

	return -1;
}

export function findLastEnabledIndex<T>(options: readonly T[], getOptionDisabled?: (option: T) => boolean) {
	for (let index = options.length - 1; index >= 0; index -= 1) {
		if (!getOptionDisabled?.(options[index])) {
			return index;
		}
	}

	return -1;
}

interface FindNextEnabledIndexOptions {
	wrap?: boolean;
}

export function findNextEnabledIndex<T>(
	options: readonly T[],
	currentIndex: number,
	step: 1 | -1,
	getOptionDisabled?: (option: T) => boolean,
	optionsConfig: FindNextEnabledIndexOptions = {}
) {
	const { wrap = false } = optionsConfig;
	const fallbackIndex = currentIndex >= 0 && currentIndex < options.length ? currentIndex : -1;

	const tryResolve = (start: number, end: number) => {
		for (let index = start; step === 1 ? index <= end : index >= end; index += step) {
			if (!getOptionDisabled?.(options[index])) {
				return index;
			}
		}

		return null;
	};

	const inBoundsResult = tryResolve(currentIndex + step, step === 1 ? options.length - 1 : 0);
	if (inBoundsResult !== null) {
		return inBoundsResult;
	}

	if (!wrap || options.length === 0) {
		return fallbackIndex;
	}

	const wrappedResult =
		step === 1
			? tryResolve(0, Math.min(currentIndex - 1, options.length - 1))
			: tryResolve(options.length - 1, Math.max(currentIndex + 1, 0));

	return wrappedResult ?? fallbackIndex;
}
