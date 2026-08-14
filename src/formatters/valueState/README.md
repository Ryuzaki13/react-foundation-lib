# Value state

`valueState` преобразует обычное значение в семантическое состояние интерфейса:

```ts
type State = "" | "none" | "information" | "success" | "warning" | "error";
```

Например, статус `DONE` можно связать с `success`, а число меньше 50 — с `error`. Модуль ничего не рисует: он вычисляет state, предоставляет CSS class/token helpers и используется formatter pipeline.

Функции импортируются из `formatters`, а общий тип `State` — из `types`:

```ts
import { createFixedResolver, createThresholdResolver, resolveValueState } from "@ryuzaki13/react-foundation-lib/formatters";
import type { State } from "@ryuzaki13/react-foundation-lib/types";
```

Отдельного package subpath `formatters/valueState` нет.

## Быстрый выбор

| Данные                          | API                                                  | Пример                    |
| ------------------------------- | ---------------------------------------------------- | ------------------------- |
| Точные коды/строки              | `createFixedResolver`                                | `DONE → success`          |
| Числовые диапазоны              | `createThresholdResolver`                            | `< 50 → error`            |
| Нужен сериализуемый короткий id | `registerFixedResolver`, `registerThresholdResolver` | id для runtime-конфига    |
| Применить resolver по id        | `resolveValueState`                                  | `(id, value) → State`     |
| Получить CSS class              | `resolveValueStateClassName`                         | `success → statusSuccess` |
| Получить цветовой token         | `VALUE_STATE_COLOR_TOKENS`                           | `success → CSS variable`  |

## Что означает каждый `State`

| State         | Обычный смысл                                   |
| ------------- | ----------------------------------------------- |
| `""`          | Пустое состояние; поддержано базовым контрактом |
| `none`        | Нейтральное значение без специального статуса   |
| `information` | Информационное состояние                        |
| `success`     | Успех или нормальное положительное значение     |
| `warning`     | Предупреждение, требующее внимания              |
| `error`       | Ошибка или критическое значение                 |

Смысл остаётся семантическим. Конкретный цвет, иконку и доступный текст определяет UI.

## Fixed resolver: точное сопоставление

### `createFixedResolver(config)`

Возвращает функцию `(value: unknown) => State`:

```ts
const resolveStatus = createFixedResolver({
	entries: {
		DONE: "success",
		WAITING: "warning",
		FAILED: "error"
	},
	fallbackState: "none"
});

resolveStatus("DONE"); // "success"
resolveStatus("WAITING"); // "warning"
resolveStatus("UNKNOWN"); // "none"
```

`fallbackState` по умолчанию равен `none`.

### Как сравниваются значения

Для `null` и `undefined` сразу возвращается fallback. Остальные значения превращаются через `String(value)` и ищутся по точному ключу `entries`:

```ts
const resolve = createFixedResolver({
	entries: {
		"1": "success",
		true: "information",
		" DONE ": "warning"
	}
});

resolve(1); // "success"
resolve("1"); // "success"
resolve(true); // "information"
resolve("DONE"); // "none"
resolve(" DONE "); // "warning"
```

Trim, изменение регистра и глубокая сериализация объектов не выполняются. Объект обычно превращается в `"[object Object]"`, поэтому fixed resolver предназначен прежде всего для scalar-кодов.

### Snapshot entries

При создании resolver-а entries копируются во внутренний `Map`. Последующая мутация исходного объекта не меняет уже созданную функцию:

```ts
const entries = { A: "success" as const };
const resolve = createFixedResolver({ entries });

entries.A = "error"; // если тип был насильно ослаблен
resolve("A"); // всё ещё исходный state
```

## Threshold resolver: числовые сегменты

### Простые пороги

```ts
const resolveProgress = createThresholdResolver({
	thresholds: [50, 80],
	states: ["error", "warning", "success"],
	invalidState: "none"
});

resolveProgress(20); // "error"
resolveProgress(50); // "warning"
resolveProgress(79); // "warning"
resolveProgress(80); // "success"
resolveProgress(100); // "success"
```

Пороги сортируются по возрастанию. Для `N` thresholds всегда нужно передать `N + 1` states:

```text
(-∞, threshold 1) → states[0]
[threshold 1, threshold 2) → states[1]
[threshold 2, +∞) → states[2]
```

Если количество не совпадает, создание/регистрация выбрасывает `Error`.

### Граница `upper` и `lower`

Число в `thresholds` эквивалентно объекту с `boundary: "upper"`:

```ts
50
// то же самое:
{ value: 50, boundary: "upper" }
```

- `upper`: само пороговое значение относится к верхнему сегменту;
- `lower`: само пороговое значение остаётся в нижнем сегменте.

```ts
const upper = createThresholdResolver({
	thresholds: [{ value: 50, boundary: "upper" }],
	states: ["error", "success"]
});

upper(49); // "error"
upper(50); // "success"
```

```ts
const lower = createThresholdResolver({
	thresholds: [{ value: 50, boundary: "lower" }],
	states: ["error", "success"]
});

lower(50); // "error"
lower(51); // "success"
```

### Преобразование входа в число

Пустая строка, `null` и `undefined` сразу дают `invalidState`. Остальное преобразуется унарным `+` и должно стать конечным числом:

```ts
const resolve = createThresholdResolver({
	thresholds: [10],
	states: ["warning", "success"],
	invalidState: "error"
});

resolve("9"); // "warning"
resolve("10"); // "success"
resolve(""); // "error"
resolve("abc"); // "error"
resolve(Infinity); // "error"
resolve(false); // "warning", потому что +false === 0
```

Это JavaScript-преобразование, а не SAP-like `parseNumber`: строка `"1 234,5"` не будет прочитана как число. Нормализуйте внешний источник заранее, если это требуется.

### Сортировка и states

Thresholds сортируются, но массив `states` не переставляется. Он уже должен описывать сегменты в возрастающем порядке:

```ts
createThresholdResolver({
	thresholds: [80, 50], // будет отсортировано как [50, 80]
	states: ["error", "warning", "success"] // порядок сегментов остаётся таким
});
```

Дублирующиеся числовые пороги допускаются, но приводят к `console.warn`. Лучше не использовать их: между одинаковыми границами получается пустой сегмент.

Threshold values не проверяются отдельно на finite. Передавайте только конечные числа.

## Прямая функция и регистрация по id

У обоих видов есть две формы API:

```ts
const fn = createFixedResolver(config);
const id = registerFixedResolver(config);
```

### Когда использовать `create*`

Когда resolver нужен непосредственно в коде:

```ts
const state = resolveStatus(row.status);
```

### Когда использовать `register*`

Когда нужно хранить короткий id и разрешать функцию через общий runtime:

```ts
const resolverId = registerThresholdResolver(config);
const state = resolveValueState(resolverId, row.value);
```

Обе формы регистрируют resolver в общем module-level реестре. `create*` не является изолированной функцией вне реестра.

## Дедупликация

Идентичные конфигурации используют одну регистрацию:

```ts
const firstId = registerFixedResolver({
	entries: { A: "success", B: "error" }
});

const secondId = registerFixedResolver({
	entries: { B: "error", A: "success" }
});

firstId === secondId; // true
```

Для fixed resolver ключи entries сортируются. Для threshold resolver пороги нормализуются и сортируются. В канонический ключ также входят states, границы и fallback/invalid state.

Идентичные вызовы `create*` возвращают одну и ту же function reference:

```ts
createFixedResolver(config) === createFixedResolver(config); // true
```

## Реестр resolver-ов

### `resolveValueState(id, value)`

Находит функцию и применяет её. Неизвестный id безопасно возвращает `none`:

```ts
resolveValueState("unknown", 10); // "none"
```

### `getValueStateResolver(id)`

Возвращает функцию либо `undefined`:

```ts
const resolver = getValueStateResolver(id);
const state = resolver?.(value) ?? "none";
```

### `getValueStateResolverIds()`

Возвращает новый массив всех id в порядке регистрации.

### `resetValueStateResolvers()`

Полностью очищает оба индекса. Функция предназначена прежде всего для тестов.

После сброса:

- старый id больше не разрешается через `resolveValueState`;
- уже полученная function reference продолжает работать;
- повторная регистрация снова создаст запись.

Не очищайте реестр в работающем приложении, если pipeline executors зависят от id.

## Низкоуровневый registry API

### `computeShortHash(input)`

Вычисляет детерминированный djb2-подобный 32-bit hash и кодирует его в base36 с префиксом `id_`:

```ts
const id = computeShortHash("fixed|A:success|none");
```

Это не криптографический hash. Он не подходит для паролей, подписей, контроля целостности и security-решений.

Коллизии отдельно не разрешаются: два разных canonical keys теоретически могут получить одинаковый id. Поэтому id — runtime-деталь дедупликации, а не долговечный бизнес-идентификатор или ключ БД.

### `registerResolver(canonicalKey, compileFunction)`

Низкоуровневая регистрация произвольного `ValueStateResolver`:

```ts
const registration = registerResolver("custom|v1", () => (value) => (value === "ok" ? "success" : "none"));

registration.id;
registration.isNew;
```

Если canonical key уже известен, `compileFunction` не вызывается и возвращается `{ isNew: false }`.

Выбирайте canonical key детерминированно и включайте в него все параметры, влияющие на результат. В обычном приложении предпочитайте `registerFixedResolver` или `registerThresholdResolver`.

### `findResolverByCanonicalKey(canonicalKey)`

Возвращает существующую функцию по точному canonical key либо `undefined`. Это инфраструктурный helper для дедупликации.

## Presentation API

### `DEFAULT_VALUE_STATES`

```ts
["none", "information", "success", "warning", "error"];
```

Список подходит для UI выбора state. Пустой state `""` намеренно не включён.

### `VALUE_STATE_COLOR_TOKENS`

```ts
{
	"": "transparent",
	none: "var(--content-1)",
	information: "var(--status-info-text)",
	success: "var(--status-success-text)",
	warning: "var(--status-warning-text)",
	error: "var(--status-error-text)"
}
```

Объект экспортируется как изменяемый `Record`, но его следует считать общей read-only таблицей. Не мутируйте токены глобально; тему меняйте через значения CSS variables.

```ts
const color = VALUE_STATE_COLOR_TOKENS[state];
```

### `resolveValueStateClassName(state, fallbackClassName?)`

| State           | Результат                 |
| --------------- | ------------------------- |
| `success`       | `statusSuccess`           |
| `warning`       | `statusWarning`           |
| `error`         | `statusError`             |
| `information`   | `statusInfo`              |
| `none` или `""` | fallback либо `undefined` |

```ts
resolveValueStateClassName("success"); // "statusSuccess"
resolveValueStateClassName("none"); // undefined
resolveValueStateClassName("none", "neutral"); // "neutral"
```

Функция возвращает имена классов, но не импортирует CSS и не гарантирует наличие стилей в consumer.

## Использование с formatter pipeline

```ts
const pipeline = {
	version: 1,
	plan: {
		steps: [
			{
				id: "state",
				type: "resolveValueState",
				config: {
					resolver: {
						kind: "threshold",
						thresholds: [50, 80],
						states: ["error", "warning", "success"]
					},
					icon: {
						enabled: true,
						showValue: true,
						position: "left"
					}
				}
			}
		]
	}
} as const;
```

Pipeline регистрирует resolver на этапе компиляции, вычисляет state до typed formatting и возвращает state/icon-параметры UI. Подробности: [pipeline/README.md](../pipeline/README.md#шаг-resolvevaluestate).

## Тестирование

Изолируйте глобальный реестр:

```ts
import { beforeEach } from "vitest";
import { resetValueStateResolvers } from "@ryuzaki13/react-foundation-lib/formatters";

beforeEach(() => {
	resetValueStateResolvers();
});
```

Для threshold resolver обязательно проверяйте:

- значение меньше первого порога;
- точное равенство каждому порогу;
- значение между порогами;
- значение выше последнего порога;
- пустые и невалидные входы;
- `lower` и `upper`, если граница настраивается.

Для fixed resolver проверяйте точный регистр, пробелы, numeric/string keys и fallback.

## Частые ошибки

### Ожидать trim и case-insensitive fixed lookup

`"DONE"`, `"done"` и `" DONE "` — разные ключи. Нормализуйте значение отдельно, только если это часть вашего контракта.

### Перепутать количество states

Два порога образуют три сегмента, поэтому нужны три states.

### Неправильно понять boundary

`upper` означает, что точный threshold уже относится к верхнему сегменту. Для включения порога в нижний используйте `lower`.

### Сохранить hash id как вечный бизнес-ключ

Алгоритм не криптографический и не обрабатывает коллизии. Храните сериализуемую resolver-конфигурацию, а id считайте runtime-производной.

### Очищать реестр после компиляции

Pipeline executor хранит id и после reset начнёт получать `none`.

## API-справка

| Семейство     | Публичный API                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed         | `createFixedResolver`, `registerFixedResolver`, `FixedValueStateResolverConfig`                                                                                            |
| Threshold     | `createThresholdResolver`, `registerThresholdResolver`, `ThresholdBoundary`, `ThresholdDefinition`, `ThresholdValueStateResolverConfig`                                    |
| Registry      | `computeShortHash`, `registerResolver`, `findResolverByCanonicalKey`, `resolveValueState`, `getValueStateResolver`, `getValueStateResolverIds`, `resetValueStateResolvers` |
| Presentation  | `DEFAULT_VALUE_STATES`, `VALUE_STATE_COLOR_TOKENS`, `resolveValueStateClassName`                                                                                           |
| Function type | `ValueStateResolver`                                                                                                                                                       |

## Связанная документация

- [Обзор `formatters`](../README.md)
- [Formatter pipeline](../pipeline/README.md)
- [Числовые форматтеры](../number/README.md)
