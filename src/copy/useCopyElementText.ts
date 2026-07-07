import { useCallback, useRef } from "react";

import { useCopyText } from "./useCopyText";
import { useElementText } from "./useElementText";

export const useCopyElementText = <T extends HTMLElement = HTMLElement>() => {
	const containerRef = useRef<T>(null);
	const { copyToClipboard } = useCopyText();
	const { getElementText } = useElementText(containerRef);

	const copyElementText = useCallback(async (): Promise<boolean> => {
		const text = getElementText();
		if (!text) return false;

		return await copyToClipboard(text);
	}, [getElementText, copyToClipboard]);

	return {
		containerRef,
		copyElementText,
		getElementText
	};
};
