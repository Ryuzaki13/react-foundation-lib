import { useEffect } from "react";

/**
 * Глобально отключает браузерный zoom (ctrl+wheel).
 *
 * @param enabled если true — блокируем нативный зум страницы
 */
export function useBlockBrowserZoom(enabled: boolean) {
	useEffect(() => {
		if (!enabled) return;

		const handler = (e: WheelEvent) => {
			if (e.ctrlKey) {
				e.preventDefault();
			}
		};

		window.addEventListener("wheel", handler, { passive: false });
		return () => window.removeEventListener("wheel", handler);
	}, [enabled]);
}
