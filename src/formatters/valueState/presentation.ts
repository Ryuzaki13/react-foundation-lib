import type { State } from "../../types";

export const DEFAULT_VALUE_STATES: readonly State[] = ["none", "information", "success", "warning", "error"];

export const VALUE_STATE_COLOR_TOKENS: Record<State, string> = {
	"": "transparent",
	none: "var(--content-1)",
	information: "var(--status-info-text)",
	success: "var(--status-success-text)",
	warning: "var(--status-warning-text)",
	error: "var(--status-error-text)"
};
