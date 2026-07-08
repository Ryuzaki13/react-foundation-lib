const DEFAULT_FONT_SIZE = 16;
const DEFAULT_LINE_HEIGHT = 1.2;

export function getCurrentFontSize(element?: HTMLElement | null): number {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return DEFAULT_FONT_SIZE;
	}

	const target = element ?? document.documentElement;
	const rootFontSize = window.getComputedStyle(target).fontSize;
	const fontSize = Number.parseFloat(rootFontSize);

	if (!Number.isFinite(fontSize) || fontSize <= 0) {
		return DEFAULT_FONT_SIZE;
	}

	return fontSize;
}

export function getCurrentLineHeight(element?: HTMLElement | null): number {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return DEFAULT_LINE_HEIGHT;
	}

	const target = element ?? document.documentElement;
	const computedStyles = window.getComputedStyle(target);
	const rootLineHeight = computedStyles.lineHeight;
	const lineHeight = Number.parseFloat(rootLineHeight);

	if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
		return DEFAULT_LINE_HEIGHT;
	}

	return lineHeight / DEFAULT_FONT_SIZE;
}

export function getControlHeight() {
	const fontSize = getCurrentFontSize();
	const lineHeight = getCurrentLineHeight();

	// Правильно расчета --control-height
	return fontSize + lineHeight * 10;
}
