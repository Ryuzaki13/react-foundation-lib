/**
 * Подставляет ID упорядоченных зависимостей в шаблон превью формулы.
 *
 * Незаданные позиции остаются в виде $n, чтобы редактор мог показывать неполный
 * черновик. Подстановка однопроходная: ID сохраняются буквально, а полученный
 * текст предназначен только для отображения и никогда не исполняется.
 */
export function formatTableFormulaExpression(expressionTemplate: string, dependencies: readonly string[]): string {
	return expressionTemplate.replace(/\$([0-9]+)/g, (placeholder: string, index: string) => {
		const dependencyId = dependencies[Number(index)];
		return dependencyId === undefined || dependencyId === "" ? placeholder : dependencyId;
	});
}
