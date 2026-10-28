import { type BREAKPOINT_MOBILE, type BREAKPOINT_TABLET, type BREAKPOINT_LAPTOP } from "./breakpointConstants";

// Границы переведены из CSS px в em относительно базового размера браузерного шрифта.
const BREAKPOINT_BASE_FONT_SIZE_PX = 16;

export const BREAKPOINTS_EM = {
	mobileMax: 479.98 / BREAKPOINT_BASE_FONT_SIZE_PX,
	tabletMin: 480 / BREAKPOINT_BASE_FONT_SIZE_PX,
	tabletMax: 1151.98 / BREAKPOINT_BASE_FONT_SIZE_PX,
	laptopMin: 1152 / BREAKPOINT_BASE_FONT_SIZE_PX
} as const;

export type Breakpoint = typeof BREAKPOINT_MOBILE | typeof BREAKPOINT_TABLET | typeof BREAKPOINT_LAPTOP;
export type MediaMatches = Record<Breakpoint, boolean>;
