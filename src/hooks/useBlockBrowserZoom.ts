import { useEffect } from "react";

const WHEEL_EVENT = "wheel";

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

		window.addEventListener(WHEEL_EVENT, handler, { passive: false });
		return () => window.removeEventListener(WHEEL_EVENT, handler);
	}, [enabled]);
}
