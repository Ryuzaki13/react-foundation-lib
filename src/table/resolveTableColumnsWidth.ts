const TABLE_COLUMN_FIXED_WIDTH_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)(?:em|px)$/;

/**
 * Возвращает сумму определённых ширин колонок без измерения DOM.
 *
 * em сохраняются в CSS, поэтому таблица масштабируется вместе со шрифтом уже
 * при SSR. auto и проценты требуют доступной ширины и остаются в ведении
 * браузерной раскладки: для них нельзя получить независимую сумму колонок.
 */
export function resolveTableColumnsWidth(widths: readonly string[]): string | undefined {
	if (widths.length === 0 || widths.some((width) => !TABLE_COLUMN_FIXED_WIDTH_PATTERN.test(width))) {
		return undefined;
	}

	return widths.length === 1 ? widths[0] : `calc(${widths.join(" + ")})`;
}
