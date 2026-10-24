/**
 * Синхронное преобразование одного исходного значения в числовое значение.
 *
 * Функция владеет разбором входа и решением для пустых или ошибочных данных.
 * Runtime сохраняет её результат буквально, включая null и undefined.
 */
export type ValueTransformerFn = (value: unknown) => number | null | undefined;

/** Метаданные доверенной функции; прикладной каталог определяет host-приложение. */
export type ValueTransformerDefinition = Readonly<{
	id: string;
	name: string;
	description: string;
	keywords?: readonly string[];
	fn: ValueTransformerFn;
}>;

/** Ошибка механизма отделена от значения, которое решила вернуть сама функция. */
export type ValueTransformerExecutionResult =
	{ ok: true; value: number | null | undefined } | { ok: false; reason: "transformer_not_found" | "runtime_error" };

export type ValueTransformerCompiledExecutor = (value: unknown) => ValueTransformerExecutionResult;

export type ValueTransformerCompileResult =
	{ ok: true; execute: ValueTransformerCompiledExecutor } | { ok: false; reason: "transformer_not_found" };
