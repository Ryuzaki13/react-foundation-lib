import { RefObject, useCallback } from "react";

export const useElementText = <T extends HTMLElement = HTMLElement>(ref: RefObject<T | null>) => {
	const getElementText = useCallback((): string => {
		return ref.current?.textContent?.trim() || "";
	}, [ref]);

	return { getElementText };
};
