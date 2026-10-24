import { isTableFormulaDependency } from "./isTableFormulaDependency";
import { type TableFormulaDependency } from "./types";

/**
 * Подставляет ID полей и числовые константы в шаблон превью формулы.
 *
 * Незаданные позиции остаются в виде $n, чтобы редактор мог показывать неполный
 * черновик. Подстановка однопроходная: ID сохраняются буквально, а полученный
 * текст предназначен только для отображения и никогда не исполняется.
 */
export function formatTableFormulaExpression(expressionTemplate: string, dependencies: readonly TableFormulaDependency[]): string {
	return expressionTemplate.replace(/\$([0-9]+)/g, (placeholder: string, index: string) => {
		const dependency = dependencies[Number(index)];
		if (!isTableFormulaDependency(dependency) || dependency === "") return placeholder;
		if (typeof dependency === "string") return dependency;

		// Скобки сохраняют смысл при вычитании, делении и возведении отрицательного значения в степень.
		return dependency.value < 0 || Object.is(dependency.value, -0) ? `(${dependency.value})` : String(dependency.value);
	});
}
