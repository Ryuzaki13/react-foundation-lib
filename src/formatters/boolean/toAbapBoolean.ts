import { AbapBoolean } from "../../types";

export function toAbapBoolean(value: unknown): AbapBoolean {
	if (typeof value === "string") {
		value = value !== "0";
	}
	return value ? "X" : " ";
}
