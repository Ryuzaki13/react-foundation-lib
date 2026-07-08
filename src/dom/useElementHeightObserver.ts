import { type RefObject, useLayoutEffect, useState } from "react";

export function useElementHeightObserver<TElement extends HTMLElement>(elementRef: RefObject<TElement | null>) {
	const [height, setHeight] = useState(0);

	useLayoutEffect(() => {
		const element = elementRef.current;
		if (!element) {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const nextHeight = entries[0]?.contentRect.height ?? element.getBoundingClientRect().height;
			setHeight(nextHeight);
		});
		observer.observe(element);

		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/refs
	}, [elementRef.current]);

	return height;
}
