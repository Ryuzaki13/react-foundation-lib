import { useEffect, useState } from "react";

export function useIntersectionObserver(ref: React.RefObject<Element | null>, options?: IntersectionObserverInit) {
	const [isIntersecting, setIsIntersecting] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const observer = new IntersectionObserver(([entry]) => {
			setIsIntersecting(entry.isIntersecting);
		}, options);

		observer.observe(el);

		return () => {
			if (el) {
				observer.unobserve(el);
			}
			observer.disconnect();
		};
	}, [options, ref]); // не забыть, что ref.current может меняться

	return { isIntersecting };
}
