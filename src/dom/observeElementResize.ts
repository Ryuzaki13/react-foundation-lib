/**
 * Наблюдает изменение одного DOM-контейнера без React state. Callback вызывается
 * в batched delivery ResizeObserver, поэтому дополнительный animation frame не нужен.
 * Возвращённый cleanup отключает observer и игнорирует уже поставленную delivery.
 */
export function observeElementResize(element: HTMLElement, onResize: () => void): () => void {
	if (typeof ResizeObserver === "undefined") return () => undefined;
	let active = true;
	const observer = new ResizeObserver((entries) => {
		if (active && entries.some((entry) => entry.target === element)) onResize();
	});
	observer.observe(element);
	return () => {
		if (!active) return;
		active = false;
		observer.disconnect();
	};
}
