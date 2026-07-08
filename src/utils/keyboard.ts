/**
 * Клавиши, которые должны активировать кастомные элементы с поведением кнопки.
 */
export const keyboardActivationKeys = ["Enter", " "] as const;

export type KeyboardActivationKey = (typeof keyboardActivationKeys)[number];

interface KeyboardActivationEventLike {
	key: string;
	preventDefault: () => void;
}

/**
 * Проверяет, что нажатая клавиша должна активировать действие элемента.
 */
export function isKeyboardActivationKey(key: string): key is KeyboardActivationKey {
	return key === "Enter" || key === " ";
}

interface HandleKeyboardActivationOptions {
	disabled?: boolean;
}

/**
 * Выполняет действие по Enter/Space для кастомных интерактивных элементов.
 *
 * Возвращает `true`, если событие было обработано библиотечной логикой.
 */
export function handleKeyboardActivation(
	event: KeyboardActivationEventLike,
	action: () => void,
	options: HandleKeyboardActivationOptions = {}
) {
	if (options.disabled || !isKeyboardActivationKey(event.key)) {
		return false;
	}

	event.preventDefault();
	action();
	return true;
}

export interface RovingFocusTargetOptions {
	currentIndex: number;
	itemCount: number;
	key: string;
	orientation: "horizontal" | "vertical";
	wrap?: boolean;
}

/**
 * Вычисляет следующую позицию для паттерна roving focus в `Tabs`, `RadioGroup`
 * и других линейных составных виджетах.
 */
export function getRovingFocusTargetIndex({ currentIndex, itemCount, key, orientation, wrap = true }: RovingFocusTargetOptions) {
	if (itemCount <= 0) {
		return null;
	}

	const safeCurrentIndex = Math.min(itemCount - 1, Math.max(0, currentIndex));
	const previousKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
	const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

	if (key === "Home") {
		return 0;
	}

	if (key === "End") {
		return itemCount - 1;
	}

	if (key === previousKey) {
		if (safeCurrentIndex > 0) {
			return safeCurrentIndex - 1;
		}

		return wrap ? itemCount - 1 : 0;
	}

	if (key === nextKey) {
		if (safeCurrentIndex < itemCount - 1) {
			return safeCurrentIndex + 1;
		}

		return wrap ? 0 : itemCount - 1;
	}

	return null;
}
