import {
	VALUE_STATE_NONE,
	VALUE_STATE_INFORMATION,
	VALUE_STATE_SUCCESS,
	VALUE_STATE_WARNING,
	VALUE_STATE_ERROR
} from "../../types/valueStateConstants";

import type { State } from "../../types";

export const DEFAULT_VALUE_STATES: readonly State[] = [
	VALUE_STATE_NONE,
	VALUE_STATE_INFORMATION,
	VALUE_STATE_SUCCESS,
	VALUE_STATE_WARNING,
	VALUE_STATE_ERROR
];

export const VALUE_STATE_COLOR_TOKENS: Record<State, string> = {
	"": "transparent",
	none: "var(--content-1)",
	information: "var(--info-text)",
	success: "var(--success-text)",
	warning: "var(--warning-text)",
	error: "var(--error-text)"
};
