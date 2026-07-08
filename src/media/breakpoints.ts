export const BREAKPOINTS_EM = {
	mobileMax: 767.98 / 16,
	tabletMin: 768 / 16,
	tabletMax: 1151.98 / 16,
	laptopMin: 1152 / 16
} as const;

export type Breakpoint = "mobile" | "tablet" | "laptop";
export type MediaMatches = Record<Breakpoint, boolean>;
