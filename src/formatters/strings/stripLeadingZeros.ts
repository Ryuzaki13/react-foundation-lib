const NORMALIZED_ZERO = "0";

/**
 * Удаляет ведущие нули из строки.
 * - "00123" -> "123"
 * - "0000"  -> "0"
 * - "-0012" -> "-12"
 * - ""      -> "0"
 * - "abc"   -> "abc"
 */
export function stripLeadingZeros(input: string): string {
	if (input == null) return "";

	// обрезаем пробелы по краям
	const str = input.trim();
	if (str === "") return NORMALIZED_ZERO;

	// проверяем отрицательное число
	const isNegative = str.startsWith("-");
	const core = isNegative ? str.slice(1) : str;

	// если core не число — вернём как есть
	if (!/^\d+$/.test(core)) {
		return str;
	}

	// удаляем ведущие нули
	const normalized = core.replace(/^0+/, "");
	const result = normalized === "" ? NORMALIZED_ZERO : normalized;

	return isNegative ? `-${result}` : result;
}
