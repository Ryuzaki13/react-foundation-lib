import { useCallback } from "react";

const clipboardFallback = async (text: string): Promise<boolean> => {
	try {
		// Создаем временный элемент с выделением
		const tempElement = document.createElement("div");
		tempElement.contentEditable = "true";
		tempElement.style.position = "fixed";
		tempElement.style.opacity = "0";
		tempElement.style.pointerEvents = "none";
		tempElement.textContent = text;

		document.body.appendChild(tempElement);

		// Выделяем текст
		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(tempElement);
		selection?.removeAllRanges();
		selection?.addRange(range);

		// Пытаемся скопировать через современный API
		const success = document.execCommand("copy"); // Это пока оставляем, но с try/catch
		selection?.removeAllRanges();
		document.body.removeChild(tempElement);

		return success;
	} catch {
		return false;
	}
};

export const useCopyText = () => {
	const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
		if (!text.trim()) return false;

		try {
			// Современный API
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				return true;
			} else {
				// Fallback для старых браузеров
				return await clipboardFallback(text);
			}
		} catch (err) {
			console.error("Failed to copy text:", err);
			return false;
		}
	}, []);

	return { copyToClipboard };
};
