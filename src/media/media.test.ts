// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { BREAKPOINTS_EM } from "./breakpoints";
import { getControlHeight, getCurrentFontSize, getCurrentLineHeight } from "./getCurrentFontSize";
import { pxToEm } from "./pxToEm";
import { isResponsiveMap, resolveProps, resolveResponsiveValue } from "./responsive";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("media helpers", () => {
	it("хранит breakpoints в em от базовых px-значений", () => {
		expect(BREAKPOINTS_EM.mobileMax).toBeCloseTo(47.99875);
		expect(BREAKPOINTS_EM.tabletMin).toBe(48);
		expect(BREAKPOINTS_EM.laptopMin).toBe(72);
	});

	it("читает font-size и line-height из computed styles с fallback", () => {
		const element = document.createElement("div");
		document.body.append(element);
		vi.spyOn(window, "getComputedStyle").mockReturnValue({
			fontSize: "20px",
			lineHeight: "24px"
		} as CSSStyleDeclaration);

		expect(getCurrentFontSize(element)).toBe(20);
		expect(getCurrentLineHeight(element)).toBe(1.5);
		expect(getControlHeight()).toBe(35);

		vi.mocked(window.getComputedStyle).mockReturnValue({
			fontSize: "bad",
			lineHeight: "bad"
		} as CSSStyleDeclaration);

		expect(getCurrentFontSize(element)).toBe(16);
		expect(getCurrentLineHeight(element)).toBe(1.2);
	});

	it("конвертирует px в em от указанной или текущей базы", () => {
		expect(pxToEm(24, 12)).toBe("2");
		vi.spyOn(window, "getComputedStyle").mockReturnValue({ fontSize: "20px", lineHeight: "24px" } as CSSStyleDeclaration);
		expect(pxToEm(10)).toBe("0.5");
	});

	it("отличает responsive map от обычного object value", () => {
		expect(isResponsiveMap({ mobile: "m" })).toBe(true);
		expect(isResponsiveMap({ desktop: "legacy" })).toBe(true);
		expect(isResponsiveMap({ value: "plain" })).toBe(false);
		expect(isResponsiveMap("plain")).toBe(false);
	});

	it("резолвит responsive value с fallback по порядку брейкпоинтов", () => {
		expect(resolveResponsiveValue("plain", "mobile")).toBe("plain");
		expect(resolveResponsiveValue(undefined, "mobile")).toBeUndefined();
		expect(resolveResponsiveValue({ tablet: "t", laptop: "l" }, "mobile")).toBe("t");
		expect(resolveResponsiveValue({ mobile: "m", laptop: "l" }, "tablet")).toBe("m");
		expect(resolveResponsiveValue({ mobile: "m", tablet: "t" }, "laptop")).toBe("t");
	});

	it("резолвит только объявленные responsive props", () => {
		expect(
			resolveProps(
				{
					size: { mobile: "s", laptop: "l" },
					tone: { value: "plain-object" },
					title: "Заголовок"
				},
				"laptop",
				["size"]
			)
		).toEqual({
			size: "l",
			tone: { value: "plain-object" },
			title: "Заголовок"
		});
	});
});
