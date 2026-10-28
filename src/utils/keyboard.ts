import {
	KEYBOARD_KEY_ARROW_DOWN,
	KEYBOARD_KEY_ARROW_LEFT,
	KEYBOARD_KEY_ARROW_RIGHT,
	KEYBOARD_KEY_ARROW_UP,
	KEYBOARD_KEY_END,
	KEYBOARD_KEY_ENTER,
	KEYBOARD_KEY_HOME,
	KEYBOARD_KEY_SPACE
} from "./keyboardConstants";

// Ориентация определяет пару клавиш одного контракта roving focus.
const ROVING_FOCUS_ORIENTATION_HORIZONTAL = "horizontal";

/**
 * Клавиши, которые должны активировать кастомные элементы с поведением кнопки.
 */
export const keyboardActivationKeys = [KEYBOARD_KEY_ENTER, KEYBOARD_KEY_SPACE] as const;

export type KeyboardActivationKey = (typeof keyboardActivationKeys)[number];

interface KeyboardActivationEventLike {
	key: string;
	preventDefault: () => void;
}

/**
 * Проверяет, что нажатая клавиша должна активировать действие элемента.
 */
export function isKeyboardActivationKey(key: string): key is KeyboardActivationKey {
	return key === KEYBOARD_KEY_ENTER || key === KEYBOARD_KEY_SPACE;
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
	orientation: typeof ROVING_FOCUS_ORIENTATION_HORIZONTAL | "vertical";
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
	const previousKey = orientation === ROVING_FOCUS_ORIENTATION_HORIZONTAL ? KEYBOARD_KEY_ARROW_LEFT : KEYBOARD_KEY_ARROW_UP;
	const nextKey = orientation === ROVING_FOCUS_ORIENTATION_HORIZONTAL ? KEYBOARD_KEY_ARROW_RIGHT : KEYBOARD_KEY_ARROW_DOWN;

	if (key === KEYBOARD_KEY_HOME) {
		return 0;
	}

	if (key === KEYBOARD_KEY_END) {
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
