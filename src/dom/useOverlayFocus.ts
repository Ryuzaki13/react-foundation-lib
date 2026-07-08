import { RefObject, useEffect, useEffectEvent, useRef } from "react";

const focusableElementsSelector =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

export interface UseOverlayFocusOptions<T extends HTMLElement> {
	active: boolean;
	trapFocus?: boolean;
	restoreFocus?: boolean;
	initialFocus?: "auto" | "container" | ((container: T) => HTMLElement | null | undefined);
	restoreFocusTarget?: () => HTMLElement | null | undefined;
	containerRef?: RefObject<T | null>;
}

/**
 * Возвращает ref overlay-контейнера и управляет начальными/возвратными переходами фокуса.
 */
export function useOverlayFocus<T extends HTMLElement>({
	active,
	trapFocus = false,
	restoreFocus = true,
	initialFocus = "auto",
	restoreFocusTarget,
	containerRef
}: UseOverlayFocusOptions<T>) {
	const internalOverlayRef = useRef<T | null>(null);
	const overlayRef = containerRef ?? internalOverlayRef;
	const previousActiveElementRef = useRef<HTMLElement | null>(null);

	/**
	 * Собирает фокусируемые элементы overlay в актуальном DOM-порядке.
	 */
	const getFocusableElements = useEffectEvent((container: T) =>
		Array.from(container.querySelectorAll<HTMLElement>(focusableElementsSelector)).filter(
			(element) => !element.hasAttribute("aria-hidden")
		)
	);

	/**
	 * Вычисляет стартовый фокус при открытии overlay.
	 */
	const resolveInitialFocus = useEffectEvent((container: T) => {
		if (initialFocus === "container") {
			return container;
		}

		if (typeof initialFocus === "function") {
			return initialFocus(container) ?? container;
		}

		const focusableElements = getFocusableElements(container);
		return (
			focusableElements.find((element) => element.hasAttribute("autofocus") || element.hasAttribute("autoFocus")) ??
			focusableElements[0] ??
			container
		);
	});

	/**
	 * Вычисляет элемент, которому нужно вернуть фокус после закрытия overlay.
	 */
	const resolveRestoreFocusTarget = useEffectEvent(() => restoreFocusTarget?.() ?? previousActiveElementRef.current);

	useEffect(() => {
		if (!active) {
			return;
		}

		previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		let overlayElement: T | null = null;
		let rafId = 0;

		/**
		 * Цикл откладывает инициализацию, пока ref контейнера не будет привязан к DOM.
		 */
		const attachOverlay = () => {
			overlayElement = overlayRef.current;
			if (!overlayElement) {
				rafId = window.requestAnimationFrame(attachOverlay);
				return;
			}

			const focusTarget = resolveInitialFocus(overlayElement);
			if (focusTarget instanceof HTMLElement && focusTarget.isConnected) {
				focusTarget.focus();
			}

			if (trapFocus) {
				overlayElement.addEventListener("keydown", handleTabKey);
			}
		};

		/**
		 * Зацикливает Tab внутри overlay, пока он открыт как модальный слой.
		 */
		const handleTabKey = (event: KeyboardEvent) => {
			if (!trapFocus || event.key !== "Tab" || !overlayElement) {
				return;
			}

			const focusableElements = getFocusableElements(overlayElement);
			if (focusableElements.length === 0) {
				event.preventDefault();
				overlayElement.focus();
				return;
			}

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];
			const activeElement = document.activeElement;

			if (event.shiftKey) {
				if (activeElement === firstElement || activeElement === overlayElement) {
					event.preventDefault();
					lastElement.focus();
				}
				return;
			}

			if (activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		};

		attachOverlay();

		return () => {
			window.cancelAnimationFrame(rafId);
			if (trapFocus && overlayElement) {
				overlayElement.removeEventListener("keydown", handleTabKey);
			}

			if (!restoreFocus) {
				return;
			}

			const restoreTarget = resolveRestoreFocusTarget();
			if (restoreTarget?.isConnected) {
				restoreTarget.focus();
			}
		};
	}, [active, trapFocus, restoreFocus, overlayRef]);

	return overlayRef;
}
