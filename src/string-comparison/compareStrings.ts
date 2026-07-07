const PROJECT_STRING_COLLATOR = new Intl.Collator("ru-RU", {
	usage: "sort",
	sensitivity: "base",
	numeric: true
});

function normalizeCompareResult(value: number): number {
	if (value < 0) return -1;
	if (value > 0) return 1;
	return 0;
}

function compareUtf16Strings(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

/**
 * Сравнивает строки по единому проектному правилу без зависимости от default locale среды.
 *
 * Основной порядок задаёт фиксированная русская коллация: она подходит для UI-списков
 * с кириллицей и естественно сортирует числовые суффиксы. Если коллатор считает строки
 * равными, UTF-16 fallback фиксирует порядок для разных регистров и похожих символов.
 */
export function compareStrings(left: string, right: string): number {
	const collatorResult = PROJECT_STRING_COLLATOR.compare(left, right);
	if (collatorResult !== 0) return normalizeCompareResult(collatorResult);
	return compareUtf16Strings(left, right);
}
