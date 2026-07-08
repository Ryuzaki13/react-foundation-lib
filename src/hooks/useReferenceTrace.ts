import { useEffect, useRef } from "react";

export function useReferenceTrace<T>(name: string, value: T) {
	const previousRef = useRef(value);

	useEffect(() => {
		if (!__DEV__) return;

		const referenceChanged = !Object.is(previousRef.current, value);

		console.debug(`[render trace] ${name}`, { referenceChanged, previous: previousRef.current, current: value });

		previousRef.current = value;
	});
}
