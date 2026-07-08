export function startsWithIgnoringZeros(value: string, searchText: string): boolean {
	const cleanValue = (value || "").toLowerCase().replace(/^0+/, "");
	const cleanText = (searchText || "").toLowerCase().replace(/^0+/, "");
	return cleanValue.startsWith(cleanText);
}
