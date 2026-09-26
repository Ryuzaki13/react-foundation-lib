import { type CapturedScrollAnchor } from "./scrollAnchorTypes";

// Один scroll host не может одновременно компенсировать один и тот же prepend дважды.
const activeAnchors = new WeakMap<HTMLElement, CapturedScrollAnchor>();

/**
 * Захватывает позицию сохраняемого элемента перед изменением обычного вертикального списка.
 * Вызывать только на browser event/effect boundary; restore — после DOM commit, release — при отмене.
 * Новый захват того же viewport завершает предыдущий без прокрутки.
 */
export function captureScrollAnchor(viewport: HTMLElement | null, anchor: HTMLElement | null): CapturedScrollAnchor | null {
	if (!viewport?.isConnected || !anchor?.isConnected || viewport === anchor || !viewport.contains(anchor)) return null;

	activeAnchors.get(viewport)?.release();
	const initialOffset =
		anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop + viewport.scrollTop;
	const initialStyle = viewport.style.getPropertyValue("overflow-anchor");
	const initialPriority = viewport.style.getPropertyPriority("overflow-anchor");
	let active = true;

	// Native anchoring иначе успеет компенсировать prepend до restore и приведёт к двойному сдвигу.
	viewport.style.setProperty("overflow-anchor", "none", "important");
	// В браузере без этого CSS-свойства native anchoring тоже отсутствует: сравниваем фактически принятый стиль.
	const ownedStyle = viewport.style.getPropertyValue("overflow-anchor");
	const ownedPriority = viewport.style.getPropertyPriority("overflow-anchor");
	const ownsStyle = () =>
		viewport.style.getPropertyValue("overflow-anchor") === ownedStyle &&
		viewport.style.getPropertyPriority("overflow-anchor") === ownedPriority;

	const operation: CapturedScrollAnchor = {
		release() {
			if (!active) return;
			active = false;
			activeAnchors.delete(viewport);
			// Не затираем новое решение host, если он сам изменил свойство во время ожидания.
			if (!ownsStyle()) return;
			if (initialStyle) viewport.style.setProperty("overflow-anchor", initialStyle, initialPriority);
			else viewport.style.removeProperty("overflow-anchor");
		},
		restore() {
			if (!active) return false;
			try {
				if (!viewport.isConnected || !anchor.isConnected || !viewport.contains(anchor) || !ownsStyle()) return false;
				const currentOffset =
					anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - viewport.clientTop + viewport.scrollTop;
				const delta = currentOffset - initialOffset;
				// Content-space delta не отменяет ручную прокрутку между запросом и commit.
				// Instant не наследует CSS smooth; горизонтальная позиция остаётся неизменной.
				if (delta !== 0) viewport.scrollBy({ top: delta, behavior: "instant" });
				return true;
			} finally {
				operation.release();
			}
		}
	};
	activeAnchors.set(viewport, operation);
	return operation;
}
