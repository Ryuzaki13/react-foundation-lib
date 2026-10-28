import { AbapBoolean } from "../../types";
import { ABAP_BOOLEAN_TRUE, ABAP_BOOLEAN_FALSE } from "../../types/abapBooleanConstants";

export function toAbapBoolean(value: unknown): AbapBoolean {
	if (typeof value === "string") {
		value = value !== "0";
	}
	return value ? ABAP_BOOLEAN_TRUE : ABAP_BOOLEAN_FALSE;
}
