import { type RefObject, useEffect, useEffectEvent } from "react";

import { KEYBOARD_KEY_ESCAPE } from "../utils/keyboardConstants";

import { DOM_KEYDOWN_EVENT } from "./domEventConstants";

interface UseEscapeDismissOptions {
	active: boolean;
	onDismiss: () => void;
	enabled?: boolean;
	documentTarget?: Document | null;
	containerRef?: RefObject<HTMLElement | null>;
}

/**
 * Подписывает overlay на закрытие по клавише Escape.
 */
export function useEscapeDismiss({ active, onDismiss, enabled = true, documentTarget, containerRef }: UseEscapeDismissOptions) {
	const dismiss = useEffectEvent(() => onDismiss());

	useEffect(() => {
		if (!active || !enabled) {
			return;
		}

		const targetDocument = documentTarget ?? (typeof document === "undefined" ? null : document);
		if (!targetDocument) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== KEYBOARD_KEY_ESCAPE /*|| event.defaultPrevented*/) {
				return;
			}

			const activeElement = targetDocument.activeElement;
			const container = containerRef?.current;
			if (container && activeElement instanceof Node && activeElement !== container && !container.contains(activeElement)) {
				return;
			}

			event.preventDefault();
			dismiss();
		};

		targetDocument.addEventListener(DOM_KEYDOWN_EVENT, handleKeyDown, true);
		return () => targetDocument.removeEventListener(DOM_KEYDOWN_EVENT, handleKeyDown, true);
	}, [active, enabled, documentTarget, containerRef]);
}
