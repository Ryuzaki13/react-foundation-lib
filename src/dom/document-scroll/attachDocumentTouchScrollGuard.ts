import { canConsumeVerticalTouchScroll } from "./canConsumeVerticalTouchScroll";
import { isNativeTouchInteraction } from "./isNativeTouchInteraction";

// Один и тот же набор событий используется при подключении и снятии защиты жеста.
const TOUCH_START_EVENT = "touchstart";
const TOUCH_MOVE_EVENT = "touchmove";
const TOUCH_END_EVENT = "touchend";
const TOUCH_CANCEL_EVENT = "touchcancel";

type TouchScrollObservation = Readonly<{
	identifier: number;
	x: number;
	y: number;
	path: readonly EventTarget[];
}>;

/**
 * Safari может передать вертикальный pan корню при открытой клавиатуре даже
 * с fixed body. Страхуем пустую область/достигнутый край, не имитируя скроллинг.
 * Один listener set живёт ровно столько же, сколько общий document lock.
 */
export function attachDocumentTouchScrollGuard(documentTarget: Document): () => void {
	const view = documentTarget.defaultView;
	let observation: TouchScrollObservation | null = null;
	let bypassGesture = false;

	const onStart = (event: TouchEvent): void => {
		// После pinch даже оставшийся один палец принадлежит тому же native gesture.
		if (bypassGesture) return;
		const touch = event.touches[0];
		const path = event.composedPath();
		if (
			event.touches.length !== 1 ||
			!touch ||
			(view?.visualViewport?.scale ?? 1) > 1 ||
			isNativeTouchInteraction(documentTarget, path)
		) {
			bypassGesture = true;
			observation = null;
			return;
		}
		observation = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY, path };
	};

	const onMove = (event: TouchEvent): void => {
		if (bypassGesture || !observation) return;
		const touch = event.touches[0];
		if (event.touches.length !== 1 || !touch || touch.identifier !== observation.identifier || (view?.visualViewport?.scale ?? 1) > 1) {
			bypassGesture = true;
			observation = null;
			return;
		}
		const { x, y, path } = observation;
		const deltaX = x - touch.clientX;
		const deltaY = y - touch.clientY;
		observation = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY, path };
		if (isNativeTouchInteraction(documentTarget, path)) {
			bypassGesture = true;
			return;
		}
		// Горизонтальные жесты, wheel и touchstart остаются без изменений.
		if (!event.cancelable || event.defaultPrevented || !deltaY || Math.abs(deltaX) >= Math.abs(deltaY)) return;
		if (!canConsumeVerticalTouchScroll(documentTarget, path, deltaY)) event.preventDefault();
	};

	const onEnd = (event: TouchEvent): void => {
		if (event.touches.length > 0) return;
		observation = null;
		bypassGesture = false;
	};

	documentTarget.addEventListener(TOUCH_START_EVENT, onStart, { capture: true, passive: true });
	documentTarget.addEventListener(TOUCH_MOVE_EVENT, onMove, { capture: true, passive: false });
	documentTarget.addEventListener(TOUCH_END_EVENT, onEnd, { capture: true, passive: true });
	documentTarget.addEventListener(TOUCH_CANCEL_EVENT, onEnd, { capture: true, passive: true });
	return () => {
		documentTarget.removeEventListener(TOUCH_START_EVENT, onStart, true);
		documentTarget.removeEventListener(TOUCH_MOVE_EVENT, onMove, true);
		documentTarget.removeEventListener(TOUCH_END_EVENT, onEnd, true);
		documentTarget.removeEventListener(TOUCH_CANCEL_EVENT, onEnd, true);
		observation = null;
	};
}
