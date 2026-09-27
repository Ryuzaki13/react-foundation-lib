import { useEffect } from "react";

import { attachVisualViewportFrame } from "./visual-viewport/attachVisualViewportFrame";
import { type UseVisualViewportFrameOptions } from "./visual-viewport/visualViewportFrameTypes";

/** CSS frame использует реальные visualViewport размеры без отмены pinch zoom; SSR оставляет CSS fallback. */
export function useVisualViewportFrame({ active, containerRef }: UseVisualViewportFrameOptions): void {
	useEffect(() => {
		if (!active || typeof window === "undefined") return;
		let frame = 0;
		let detach: (() => void) | undefined;
		// Portal может установить ref позже родительского effect; ожидание завершается при cleanup.
		const attach = () => {
			const container = containerRef.current;
			if (container) detach = attachVisualViewportFrame(container);
			else frame = window.requestAnimationFrame(attach);
		};
		attach();
		return () => {
			window.cancelAnimationFrame(frame);
			detach?.();
		};
	}, [active, containerRef]);
}
