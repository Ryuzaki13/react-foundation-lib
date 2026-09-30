import type { State } from "../../types";

export const DEFAULT_VALUE_STATES: readonly State[] = ["none", "information", "success", "warning", "error"];

export const VALUE_STATE_COLOR_TOKENS: Record<State, string> = {
	"": "transparent",
	none: "var(--content-1)",
	information: "var(--info-text)",
	success: "var(--success-text)",
	warning: "var(--warning-text)",
	error: "var(--error-text)"
};
