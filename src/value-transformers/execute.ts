import { getValueTransformerById } from "./registry";
import { type ValueTransformerCompileResult, type ValueTransformerExecutionResult } from "./types";
import { VALUE_TRANSFORMER_NOT_FOUND, VALUE_TRANSFORMER_RUNTIME_ERROR } from "./valueTransformerConstants";

/**
 * Фиксирует доверенную функцию один раз для многократной обработки значений.
 *
 * Вход и результат не приводятся к числу и не заменяются значением по умолчанию:
 * parsing и правила пустых данных принадлежат самой функции преобразования.
 */
export function compileValueTransformer(args: { transformerId: string | undefined }): ValueTransformerCompileResult {
	const definition = getValueTransformerById(args.transformerId);
	if (!definition) return { ok: false, reason: VALUE_TRANSFORMER_NOT_FOUND };
	const fn = definition.fn;

	return {
		ok: true,
		execute: (value) => {
			try {
				return { ok: true, value: fn(value) };
			} catch {
				return { ok: false, reason: VALUE_TRANSFORMER_RUNTIME_ERROR };
			}
		}
	};
}

/** Разовый запуск через активный реестр; для строк таблицы предпочтительна предварительная компиляция. */
export function executeValueTransformer(args: { transformerId: string | undefined; value: unknown }): ValueTransformerExecutionResult {
	const compiled = compileValueTransformer(args);
	return compiled.ok ? compiled.execute(args.value) : { ok: false, reason: compiled.reason };
}
