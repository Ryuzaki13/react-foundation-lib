# Boolean и ABAP boolean через `@ryuzaki13/react-foundation-lib/formatters`

Подмодуль `boolean` преобразует значения между JavaScript `boolean` и двухсимвольным ABAP-контрактом:

- `"X"` — истина;
- один обычный пробел `" "` — ложь.

Также он предоставляет более широкий parser `parseBoolean` для простых пользовательских или transport-значений.

README рассчитан на разработчика без доступа к исходному коду. Ниже описано точное, местами неочевидное поведение всех трёх публичных функций. Особенно важно не путать строгий `parseAbapBoolean`, расширенный `parseBoolean` и truthy-семантику `toAbapBoolean`.

## Содержание

- [Назначение и границы](#назначение-и-границы)
- [Установка и импорт](#установка-и-импорт)
- [Минимальные понятия](#минимальные-понятия)
- [Как выбрать функцию](#как-выбрать-функцию)
- [`parseAbapBoolean`](#parseabapboolean)
- [`parseBoolean`](#parseboolean)
- [`toAbapBoolean`](#toabapboolean)
- [Практические рецепты](#практические-рецепты)
- [Ошибки и ограничения](#ошибки-и-ограничения)
- [Тестирование](#тестирование)
- [Краткий справочник](#краткий-справочник)
- [Вопросы и ответы](#вопросы-и-ответы)

## Назначение и границы

### Что делает подмодуль

- строго читает ABAP boolean `"X"`;
- распознаёт небольшой набор строковых true-значений;
- применяет стандартную JavaScript truthy/falsy-семантику к нестроковым значениям;
- формирует `AbapBoolean`, то есть `"X" | " "`.

### Чего подмодуль не делает

- не нормализует пробелы через `trim()`;
- не принимает `"да"`, `"нет"`, `"yes"`, `"no"`, `"on"`, `"off"`;
- не валидирует внешний DTO целиком;
- не сообщает, почему значение было интерпретировано как `false`;
- не отличает отсутствующее значение от явно переданного `false`;
- не сериализует JSON, URL или OData query;
- не гарантирует, что широкий `toAbapBoolean(unknown)` подходит конкретному backend-контракту.

## Установка и импорт

Установите пакет:

```bash
npm install @ryuzaki13/react-foundation-lib
```

Все boolean helpers импортируются из единственного опубликованного subpath `/formatters`:

```ts
import { parseAbapBoolean, parseBoolean, toAbapBoolean } from "@ryuzaki13/react-foundation-lib/formatters";

import type { AbapBoolean } from "@ryuzaki13/react-foundation-lib/types";
```

Отдельного package export `/formatters/boolean` нет:

```ts
// Неправильно.
import { parseAbapBoolean } from "@ryuzaki13/react-foundation-lib/formatters/boolean";

// Правильно.
import { parseAbapBoolean } from "@ryuzaki13/react-foundation-lib/formatters";
```

Функции не зависят от React, DOM или browser API и могут выполняться в browser, Node.js и worker runtime.

## Минимальные понятия

### JavaScript boolean

Тип `boolean` имеет только два значения:

```ts
const enabled: boolean = true;
const disabled: boolean = false;
```

Строки `"true"` и `"false"` не являются boolean:

```ts
typeof true; // "boolean"
typeof "true"; // "string"
```

### Truthy и falsy

JavaScript умеет приводить произвольное значение к boolean:

```ts
Boolean(1); // true
Boolean(0); // false
Boolean("text"); // true
Boolean(""); // false
Boolean({}); // true
Boolean([]); // true
```

Основные falsy-значения:

- `false`;
- `0` и `-0`;
- `0n`;
- пустая строка `""`;
- `null`;
- `undefined`;
- `NaN`.

Почти всё остальное truthy. В частности, строки `"false"`, `"0 "`, объекты и массивы truthy.

### ABAP boolean

Публичный тип пакета:

```ts
type AbapBoolean = "X" | " ";
```

Ложь представлена не пустой строкой, а ровно одним пробелом. Это важно при сравнении, логировании и сериализации:

```ts
const value: AbapBoolean = " ";

console.log(value.length); // 1
console.log(value === ""); // false
```

### `unknown`

Все три функции принимают `unknown`. Это означает, что caller может передать любое runtime-значение, а функция сама выберет ветку обработки.

Широкий вход удобен на transport boundary, но не превращает функцию в строгий validator. Если нужно отклонять неизвестные значения, сначала реализуйте явную validation policy.

## Как выбрать функцию

| Задача                                               | Функция            |
| ---------------------------------------------------- | ------------------ |
| Прочитать точное backend-значение `"X"`/`" "`        | `parseAbapBoolean` |
| Прочитать `true`, `"true"`, `"X"`, `"x"`, `1`, `"1"` | `parseBoolean`     |
| Записать JavaScript boolean в ABAP `"X"`/`" "`       | `toAbapBoolean`    |

Для DTO с известным ABAP-контрактом предпочтительная пара:

```ts
const enabled = parseAbapBoolean(dto.ENABLED);
const payload = { ENABLED: toAbapBoolean(enabled) };
```

Не заменяйте строгий parser на `parseBoolean` без осознанного расширения контракта: lowercase `"x"` строгий parser отвергает, а расширенный принимает.

## `parseAbapBoolean`

### Сигнатура

```ts
function parseAbapBoolean(value: unknown): boolean;
```

Функция возвращает `true` только для строки, которая в точности равна uppercase `"X"`.

```ts
parseAbapBoolean("X"); // true
parseAbapBoolean(" "); // false
```

### Точная таблица поведения

| Вход        | Результат | Причина                          |
| ----------- | --------- | -------------------------------- |
| `"X"`       | `true`    | точное допустимое значение       |
| `"x"`       | `false`   | регистр отличается               |
| `" X "`     | `false`   | функция не вызывает `trim()`     |
| `"true"`    | `false`   | это не ABAP marker               |
| `"1"`       | `false`   | это не ABAP marker               |
| `" "`       | `false`   | ABAP false                       |
| `""`        | `false`   | пустая строка                    |
| `true`      | `false`   | функция требует строку `"X"`     |
| `1`         | `false`   | функция требует строку `"X"`     |
| `null`      | `false`   | любое другое значение даёт false |
| `undefined` | `false`   | любое другое значение даёт false |

### Важное следствие

Функция не отличает несколько разных ситуаций:

- backend явно прислал `" "`;
- поле отсутствует;
- backend прислал ошибочное `"x"`;
- backend прислал число;
- caller передал `null`.

Во всех случаях результат равен `false`. Если различие важно, проверьте внешний контракт до вызова:

```ts
function assertAbapBoolean(value: unknown): asserts value is AbapBoolean {
	if (value !== "X" && value !== " ") {
		throw new TypeError("Ожидалось ABAP boolean: 'X' или один пробел");
	}
}

assertAbapBoolean(dto.ENABLED);
const enabled = parseAbapBoolean(dto.ENABLED);
```

## `parseBoolean`

### Сигнатура

```ts
function parseBoolean(value: unknown): boolean;
```

Алгоритм:

1. любое falsy-значение сразу превращается в `false`;
2. строка приводится к lowercase без `trim()`;
3. строка считается истинной только для `"true"`, `"x"` или `"1"`;
4. нестроковое truthy-значение обрабатывается через `Boolean(value)`.

### Строки

```ts
parseBoolean("true"); // true
parseBoolean("TRUE"); // true
parseBoolean("X"); // true
parseBoolean("x"); // true
parseBoolean("1"); // true

parseBoolean("false"); // false
parseBoolean("0"); // false
parseBoolean("yes"); // false
parseBoolean(" true "); // false: пробелы не обрезаются
parseBoolean(""); // false
```

Для строк функция не использует общую truthy-семантику. Например, обычная JavaScript-строка `"false"` truthy, но `parseBoolean("false")` специально возвращает `false`.

### Нестроковые значения

```ts
parseBoolean(true); // true
parseBoolean(false); // false
parseBoolean(1); // true
parseBoolean(-1); // true
parseBoolean(0); // false
parseBoolean({}); // true
parseBoolean([]); // true
parseBoolean(null); // false
parseBoolean(undefined); // false
```

Объект и массив не означают логическую истину предметной области. Они лишь truthy по правилам JavaScript. Не передавайте произвольный JSON object, если ожидается строгий boolean scalar.

### Когда применять

`parseBoolean` полезен, если входной контракт осознанно допускает несколько представлений:

```ts
type FeatureFlagInput = boolean | 0 | 1 | "0" | "1" | "true" | "false" | "X" | " ";

function readFeatureFlag(value: FeatureFlagInput): boolean {
	return parseBoolean(value);
}
```

Но обратите внимание: строка `" "` даст `false` не потому, что специально распознана как ABAP false, а потому что её нет в списке true-строк.

## `toAbapBoolean`

### Сигнатура

```ts
function toAbapBoolean(value: unknown): AbapBoolean;
```

Алгоритм имеет отдельное правило для строк:

1. если вход — строка, false означает только точная строка `"0"`;
2. любая другая строка превращается в true;
3. нестроковое значение проверяется стандартной truthy/falsy-семантикой;
4. true возвращается как `"X"`, false — как один пробел `" "`.

### Рекомендуемый вход

Передавайте настоящий boolean:

```ts
toAbapBoolean(true); // "X"
toAbapBoolean(false); // " "
```

Это самый понятный и устойчивый сценарий.

### Строки: важная ловушка

```ts
toAbapBoolean("0"); // " "

toAbapBoolean("1"); // "X"
toAbapBoolean("false"); // "X"
toAbapBoolean(""); // "X"
toAbapBoolean(" "); // "X"
toAbapBoolean("00"); // "X"
```

Здесь `"false"` не парсится как false. Функция проверяет только неравенство строке `"0"`.

Если внешний input может содержать текстовые boolean-значения, сначала примените нужный parser:

```ts
const normalized = parseBoolean(rawValue);
const abapValue = toAbapBoolean(normalized);
```

Результаты:

```ts
toAbapBoolean(parseBoolean("false")); // " "
toAbapBoolean(parseBoolean("true")); // "X"
```

### Нестроковые значения

```ts
toAbapBoolean(1); // "X"
toAbapBoolean(0); // " "
toAbapBoolean(null); // " "
toAbapBoolean(undefined); // " "
toAbapBoolean({}); // "X"
toAbapBoolean([]); // "X"
```

Для объектов и массивов используется только truthiness. Функция не читает поля объекта и не проверяет длину массива.

## Практические рецепты

### DTO → domain model

```ts
type UserDto = {
	IS_ACTIVE: "X" | " ";
};

type User = {
	isActive: boolean;
};

function mapUserDto(dto: UserDto): User {
	return {
		isActive: parseAbapBoolean(dto.IS_ACTIVE)
	};
}
```

### Domain model → DTO

```ts
type UpdateUserPayload = {
	IS_ACTIVE: AbapBoolean;
};

function createUpdateUserPayload(isActive: boolean): UpdateUserPayload {
	return {
		IS_ACTIVE: toAbapBoolean(isActive)
	};
}
```

### Строгая проверка неизвестного transport-значения

```ts
function readRequiredAbapBoolean(value: unknown): boolean {
	if (value !== "X" && value !== " ") {
		throw new TypeError("Некорректное ABAP boolean");
	}

	return parseAbapBoolean(value);
}
```

### Form value `"0"`/`"1"` → ABAP

```ts
function formValueToAbapBoolean(value: "0" | "1"): AbapBoolean {
	return toAbapBoolean(value);
}
```

Это безопасно только потому, что TypeScript contract заранее ограничил две допустимые строки.

### Form value `"true"`/`"false"` → ABAP

```ts
function textBooleanToAbap(value: "true" | "false"): AbapBoolean {
	return toAbapBoolean(parseBoolean(value));
}
```

Прямой `toAbapBoolean("false")` дал бы `"X"`.

## Ошибки и ограничения

Функции обычно не бросают исключения: для любого обычного значения они возвращают boolean или `AbapBoolean`.

Но это означает silent coercion:

- ошибочная форма не отклоняется;
- неизвестное ABAP-значение превращается в false;
- объект превращается в true в широких функциях;
- внешние пробелы не нормализуются;
- `toAbapBoolean("false")` возвращает true marker.

Рекомендации:

- используйте `parseAbapBoolean` для точного ABAP read;
- передавайте boolean в `toAbapBoolean`;
- валидируйте `unknown`, если неверное значение должно считаться ошибкой;
- не стройте бизнес-правило на общей truthy/falsy-семантике;
- не логируйте ABAP false без кавычек: один пробел визуально незаметен.

## Тестирование

Минимальная матрица consumer-теста:

```ts
expect(parseAbapBoolean("X")).toBe(true);
expect(parseAbapBoolean("x")).toBe(false);
expect(parseAbapBoolean(" ")).toBe(false);

expect(parseBoolean("true")).toBe(true);
expect(parseBoolean("X")).toBe(true);
expect(parseBoolean("0")).toBe(false);
expect(parseBoolean(" true ")).toBe(false);

expect(toAbapBoolean(true)).toBe("X");
expect(toAbapBoolean(false)).toBe(" ");
expect(toAbapBoolean("0")).toBe(" ");
expect(toAbapBoolean("false")).toBe("X");
```

Если ваш DTO объявляет поле обязательным, отдельно тестируйте runtime validation отсутствующего и неизвестного значения. Успешный `parseAbapBoolean(undefined) === false` не доказывает корректность DTO.

## Краткий справочник

| API                | Вход      | Результат     | Главное правило                                       |
| ------------------ | --------- | ------------- | ----------------------------------------------------- |
| `parseAbapBoolean` | `unknown` | `boolean`     | true только для точного `"X"`                         |
| `parseBoolean`     | `unknown` | `boolean`     | строки true только `true`, `x`, `1`; иначе truthiness |
| `toAbapBoolean`    | `unknown` | `AbapBoolean` | строка false только при точном `"0"`                  |

## Вопросы и ответы

### Почему `parseAbapBoolean("x")` вернул false?

ABAP parser регистрозависим и принимает только uppercase `"X"`.

### Почему `parseBoolean(" true ")` вернул false?

Функция приводит строку к lowercase, но не вызывает `trim()`. Нормализуйте transport input заранее только если это разрешено его контрактом.

### Почему `toAbapBoolean("false")` вернул `"X"`?

Для строк функция считает ложью только точное значение `"0"`. Передайте boolean либо сначала вызовите `parseBoolean`.

### Почему ABAP false выглядит как пустота?

Это один обычный пробел. Проверяйте через строгое равенство и показывайте в diagnostics с кавычками или через `JSON.stringify`.

### Можно ли сделать round trip?

Для настоящего `AbapBoolean` — да:

```ts
toAbapBoolean(parseAbapBoolean("X")); // "X"
toAbapBoolean(parseAbapBoolean(" ")); // " "
```

Для произвольной строки round trip не определён, потому что parsers и serializer используют разные правила.

## Связанная документация

- [Обзор всего модуля `formatters`](../README.md)
- [Строковая нормализация](../strings/README.md)
- [Formatter pipeline](../pipeline/README.md)
