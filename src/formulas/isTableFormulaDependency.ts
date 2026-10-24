import { type TableFormulaDependency } from "./types";

/** Проверяет внешний аргумент без приведения пустых строк или нечисловых значений к нулю. */
export function isTableFormulaDependency(value: unknown): value is TableFormulaDependency {
	if (typeof value === "string") return true;
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

	return (
		"kind" in value && value.kind === "constant" && "value" in value && typeof value.value === "number" && Number.isFinite(value.value)
	);
}
