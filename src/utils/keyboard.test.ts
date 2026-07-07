import { describe, expect, it, vi } from "vitest";

import { getRovingFocusTargetIndex, handleKeyboardActivation, isKeyboardActivationKey } from "./keyboard";
import { findFirstEnabledIndex, findLastEnabledIndex, findNextEnabledIndex } from "./selectNavigation";

describe("keyboard utils", () => {
	it("распознаёт клавиши активации", () => {
		expect(isKeyboardActivationKey("Enter")).toBe(true);
		expect(isKeyboardActivationKey(" ")).toBe(true);
		expect(isKeyboardActivationKey("Spacebar")).toBe(false);
		expect(isKeyboardActivationKey("Escape")).toBe(false);
	});

	it("обрабатывает активацию только для Enter и Space", () => {
		const action = vi.fn();
		const preventDefault = vi.fn();

		expect(handleKeyboardActivation({ key: "Enter", preventDefault }, action)).toBe(true);
		expect(preventDefault).toHaveBeenCalledTimes(1);
		expect(action).toHaveBeenCalledTimes(1);

		expect(handleKeyboardActivation({ key: "Escape", preventDefault }, action)).toBe(false);
		expect(action).toHaveBeenCalledTimes(1);
	});

	it("не активирует действие для disabled-элемента", () => {
		const action = vi.fn();
		const preventDefault = vi.fn();

		expect(handleKeyboardActivation({ key: " ", preventDefault }, action, { disabled: true })).toBe(false);
		expect(preventDefault).not.toHaveBeenCalled();
		expect(action).not.toHaveBeenCalled();
	});

	it("вычисляет roving focus для горизонтальной группы", () => {
		expect(
			getRovingFocusTargetIndex({
				currentIndex: 1,
				itemCount: 3,
				key: "ArrowRight",
				orientation: "horizontal"
			})
		).toBe(2);

		expect(
			getRovingFocusTargetIndex({
				currentIndex: 2,
				itemCount: 3,
				key: "ArrowRight",
				orientation: "horizontal"
			})
		).toBe(0);
	});

	it("вычисляет roving focus для вертикальной группы", () => {
		expect(
			getRovingFocusTargetIndex({
				currentIndex: 1,
				itemCount: 4,
				key: "ArrowUp",
				orientation: "vertical"
			})
		).toBe(0);

		expect(
			getRovingFocusTargetIndex({
				currentIndex: 0,
				itemCount: 4,
				key: "End",
				orientation: "vertical"
			})
		).toBe(3);
	});
});

describe("select navigation", () => {
	const options = [{ disabled: false }, { disabled: true }, { disabled: false }, { disabled: false }];
	const getDisabled = (option: (typeof options)[number]) => option.disabled;

	it("ищет первую и последнюю доступные опции", () => {
		expect(findFirstEnabledIndex(options, getDisabled)).toBe(0);
		expect(findLastEnabledIndex(options, getDisabled)).toBe(3);
	});

	it("пропускает disabled-элементы при движении вперёд и назад", () => {
		expect(findNextEnabledIndex(options, 0, 1, getDisabled)).toBe(2);
		expect(findNextEnabledIndex(options, 3, -1, getDisabled)).toBe(2);
	});

	it("поддерживает циклическую навигацию при необходимости", () => {
		expect(findNextEnabledIndex(options, 3, 1, getDisabled, { wrap: true })).toBe(0);
		expect(findNextEnabledIndex(options, 0, -1, getDisabled, { wrap: true })).toBe(3);
	});
});
