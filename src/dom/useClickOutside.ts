import { type RefObject, useEffect } from "react";

const MOUSE_DOWN_EVENT = "mousedown";

export function useClickOutside(ref: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[], handler: () => void) {
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (Array.isArray(ref)) {
				let isOutside = true;
				for (const r of ref) {
					if (r.current && r.current.contains(event.target as Node)) {
						isOutside = false;
					}
				}
				if (isOutside) {
					handler();
				}
			} else if (ref.current && !ref.current.contains(event.target as Node)) {
				handler();
			}
		};

		document.addEventListener(MOUSE_DOWN_EVENT, handleClickOutside);
		return () => document.removeEventListener(MOUSE_DOWN_EVENT, handleClickOutside);
	}, [ref, handler]);
}
