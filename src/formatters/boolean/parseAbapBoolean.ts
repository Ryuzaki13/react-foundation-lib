import { ABAP_BOOLEAN_TRUE } from "../../types/abapBooleanConstants";

export function parseAbapBoolean(value: unknown): boolean {
	if (value && typeof value === "string" && value === ABAP_BOOLEAN_TRUE) return true;
	return false;
}

export function parseBoolean(value: unknown): boolean {
	if (!value) return false;
	if (typeof value === "string") {
		return ["true", "x", "1"].includes(value.toLowerCase());
	}
	return Boolean(value);
}
