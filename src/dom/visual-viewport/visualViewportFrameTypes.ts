import { type RefObject } from "react";

/** Визуальная область браузера для CSS fixed-поверхности, включая экранную клавиатуру. */
export type UseVisualViewportFrameOptions = Readonly<{
	active: boolean;
	containerRef: RefObject<HTMLElement | null>;
}>;
