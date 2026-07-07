import { useOverlayFocus } from "./useOverlayFocus";

/**
 * Совместимый wrapper для overlay с фокус-ловушкой.
 */
export const useFocusTrap = (isOpen: boolean) => {
	return useOverlayFocus<HTMLDivElement>({ active: isOpen, trapFocus: true, restoreFocus: true, initialFocus: "auto" });
};
