import { State } from "../../types";

export function resolveValueStateClassName(state: State, fallbackClassName?: string): string | undefined {
	switch (state) {
		case "success":
			return "statusSuccess";
		case "warning":
			return "statusWarning";
		case "error":
			return "statusError";
		case "information":
			return "statusInfo";
		default:
			return fallbackClassName;
	}
}
