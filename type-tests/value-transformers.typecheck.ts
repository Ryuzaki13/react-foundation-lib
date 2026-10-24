import {
	compileValueTransformer,
	configureValueTransformerRegistry,
	createValueTransformerRegistry,
	executeValueTransformer,
	getValueTransformerById,
	getValueTransformerList,
	type ValueTransformerCompiledExecutor,
	type ValueTransformerCompileResult,
	type ValueTransformerDefinition,
	type ValueTransformerExecutionResult,
	type ValueTransformerFn,
	type ValueTransformerRegistry
} from "../src/value-transformers";

const transform: ValueTransformerFn = (value) => (typeof value === "number" ? value * 2 : value == null ? value : undefined);
const definition: ValueTransformerDefinition = { id: "double", name: "Удвоение", description: "", fn: transform };
const registry: ValueTransformerRegistry = createValueTransformerRegistry([definition]);
configureValueTransformerRegistry(registry);
const definitions: readonly ValueTransformerDefinition[] = getValueTransformerList();
const selected: ValueTransformerDefinition | undefined = getValueTransformerById("double");
const compiled: ValueTransformerCompileResult = compileValueTransformer({ transformerId: "double" });
const result: ValueTransformerExecutionResult = executeValueTransformer({ transformerId: "double", value: { unknownShape: true } });

if (compiled.ok) {
	const executor: ValueTransformerCompiledExecutor = compiled.execute;
	const execution = executor(undefined);
	if (execution.ok) {
		const rawValue: number | null | undefined = execution.value;
		void rawValue;
	}
}

// @ts-expect-error Вход неизвестен до проверки внутри функции.
const numericOnlyInput: ValueTransformerFn = (value: number) => value * 2;
// @ts-expect-error Числовое преобразование не возвращает строку.
const stringResult: ValueTransformerFn = () => "2";
// @ts-expect-error Runtime выполняет только синхронные преобразования.
const asyncResult: ValueTransformerFn = async () => 2;

void [definitions, selected, result, numericOnlyInput, stringResult, asyncResult];
