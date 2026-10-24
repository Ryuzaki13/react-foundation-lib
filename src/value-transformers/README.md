# Преобразования числовых значений

Публичный subpath `@ryuzaki13/react-foundation-lib/value-transformers` предоставляет реестр и синхронное исполнение доверенных функций одного аргумента. Прикладные определения принадлежат host-приложению; встроенного каталога операций или единиц измерения нет.

## Контракт функции

```ts
import { type ValueTransformerDefinition } from "@ryuzaki13/react-foundation-lib/value-transformers";

const definition: ValueTransformerDefinition = {
	id: "double",
	name: "Удвоение",
	description: "Удваивает числовое значение; остальные входы оставляет без результата.",
	fn: (value) => (typeof value === "number" ? value * 2 : undefined)
};
```

`ValueTransformerFn` принимает `unknown` и возвращает `number | null | undefined`. Функция сама определяет разбор строк, допустимые типы, конечность числа и поведение при пустых или ошибочных данных. Механизм не вызывает `Number`, не подставляет `0` и не меняет результат функции, включая `null`, `undefined`, `NaN` или `Infinity`. Эти правила не наследуются от табличных формул или display-форматтеров.

Функция должна работать синхронно. Вход передаётся буквально и не копируется: определение не должно изменять объекты строки, Query cache или внешнее состояние. Асинхронные функции и строковые результаты не входят в TypeScript-контракт.

## Реестр

```ts
import { configureValueTransformerRegistry, createValueTransformerRegistry } from "@ryuzaki13/react-foundation-lib/value-transformers";

const registry = createValueTransformerRegistry([definition]);
configureValueTransformerRegistry(registry);
```

Host устанавливает каталог в composition root до чтения или компиляции. `createValueTransformerRegistry` сохраняет порядок определений, удаляет внешние пробелы в `id`, `name` и `description`, отклоняет пустой и повторный ID. Registry object, список, определения и независимые копии `keywords` заморожены; индекс представлен `ReadonlyMap`.

`getValueTransformerList()` возвращает текущий readonly-список. `getValueTransformerById(id)` удаляет внешние пробелы в ID и возвращает `undefined` для пустого или неизвестного ID. Создание каталога не устанавливает его автоматически; `configureValueTransformerRegistry` полностью заменяет активный каталог данного экземпляра модуля.

## Исполнение

```ts
import { compileValueTransformer, executeValueTransformer } from "@ryuzaki13/react-foundation-lib/value-transformers";

executeValueTransformer({ transformerId: "double", value: 3 });
// { ok: true, value: 6 }

const compiled = compileValueTransformer({ transformerId: "double" });
if (compiled.ok) {
	compiled.execute(3); // { ok: true, value: 6 }
	compiled.execute(null); // { ok: true, value: undefined } — решение fn из примера
}
```

Разовый `executeValueTransformer` использует активный каталог. Для повторной обработки строк `compileValueTransformer` фиксирует функцию один раз: замена исходного определения или активного registry не меняет уже созданный executor.

Compile-result: `{ ok: true, execute } | { ok: false, reason: "transformer_not_found" }`.

Execution-result: `{ ok: true, value: number | null | undefined } | { ok: false, reason: "transformer_not_found" | "runtime_error" }`. Неизвестный ID даёт `transformer_not_found`; исключение функции — `runtime_error`. Ошибка не содержит исходное значение и не превращается в успешный результат по умолчанию. Потребитель отвечает за контекст диагностики и отображение ошибки.

Модуль не читает поля строки, не строит граф зависимостей и не материализует колонки. Потребитель выбирает исходное поле, передаёт его значение и записывает успешный результат в принадлежащую ему модель до исполнения зависимых формул. Сериализуемая конфигурация хранит стабильный ID преобразования, а функция остаётся доверенным кодом приложения.
