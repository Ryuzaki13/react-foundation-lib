export function readPositiveInteger(value: unknown): number | undefined {
	const numericValue = typeof value === "string" ? Number(value) : value;

	if (typeof numericValue !== "number" || !Number.isInteger(numericValue) || numericValue <= 0) {
		return undefined;
	}

	return numericValue;
}
