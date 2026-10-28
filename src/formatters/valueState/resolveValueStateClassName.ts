import { State } from "../../types";
import { VALUE_STATE_SUCCESS, VALUE_STATE_WARNING, VALUE_STATE_ERROR, VALUE_STATE_INFORMATION } from "../../types/valueStateConstants";

export function resolveValueStateClassName(state: State, fallbackClassName?: string): string | undefined {
	switch (state) {
		case VALUE_STATE_SUCCESS:
			return "statusSuccess";
		case VALUE_STATE_WARNING:
			return "statusWarning";
		case VALUE_STATE_ERROR:
			return "statusError";
		case VALUE_STATE_INFORMATION:
			return "statusInfo";
		default:
			return fallbackClassName;
	}
}
