import { useCallback, useState } from "react";

import { useCopyElementText } from "./useCopyElementText";

const COPY_FEEDBACK_DURATION_MS = 2_000;

export const useCopyFeedback = () => {
	const [isCopied, setIsCopied] = useState(false);

	const showFeedback = useCallback(() => {
		setIsCopied(true);
		const timer = setTimeout(() => setIsCopied(false), COPY_FEEDBACK_DURATION_MS);
		return () => clearTimeout(timer);
	}, []);

	return { isCopied, showFeedback };
};

// Обновленный useCopyElementText с фидбэком
export const useCopyElementTextWithFeedback = <T extends HTMLElement = HTMLElement>() => {
	const { containerRef, copyElementText, getElementText } = useCopyElementText<T>();
	const { isCopied, showFeedback } = useCopyFeedback();

	const copyWithFeedback = useCallback(async (): Promise<boolean> => {
		const success = await copyElementText();
		if (success) {
			showFeedback();
		}
		return success;
	}, [copyElementText, showFeedback]);

	return {
		containerRef,
		copyElementText: copyWithFeedback,
		getElementText,
		isCopied
	};
};
