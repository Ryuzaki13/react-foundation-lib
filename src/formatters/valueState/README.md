# Value State Resolver

Модуль для определения визуального состояния (`State`) ячейки таблицы по значению.
Поддерживает два типа резолверов: **пороговый** (диапазоны числовых значений) и **фиксированный** (точное совпадение).

## Архитектура

```
valueStateRegistry.ts        — общий реестр, resolveValueState, хеш-функция
valueStateResolver.ts        — пороговый резолвер (числовые диапазоны)
fixedValueStateResolver.ts   — фиксированный резолвер (точное совпадение)
```

Все резолверы живут в **едином реестре** и вызываются через `resolveValueState(id, value)`.
Ячейке таблицы не нужно знать тип резолвера — достаточно `id`.

## Быстрый старт

### Пороговый резолвер (числовые диапазоны)

```ts
import { registerThresholdResolver, resolveValueState } from "@/shared/lib";

const id = registerThresholdResolver({
	thresholds: [60, 95],
	states: ["warning", "success", "error"]
});

resolveValueState(id, 45); // → "warning"
resolveValueState(id, 75); // → "success"
resolveValueState(id, 100); // → "error"
```

### Фиксированный резолвер (точное совпадение)

```ts
import { registerFixedResolver, resolveValueState } from "@/shared/lib";

const id = registerFixedResolver({
	entries: { "01": "success", "02": "warning", "03": "error" },
	fallbackState: "none"
});

resolveValueState(id, "01"); // → "success"
resolveValueState(id, "02"); // → "warning"
resolveValueState(id, "99"); // → "none" (fallback)
```

### Прямое использование (без явного id)

```ts
const resolve = createThresholdResolver({
	thresholds: [60, 95],
	states: ["warning", "success", "error"]
});
resolve(75); // → "success"

const resolveFixed = createFixedResolver({
	entries: { A: "success", B: "error" }
});
resolveFixed("A"); // → "success"
```

## API

### Общий реестр (`valueStateRegistry.ts`)

| Функция                                                      | Описание                                              |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `resolveValueState(id, value): State`                        | Применить резолвер по `id`. Если не найден — `"none"` |
| `getValueStateResolver(id): ValueStateResolver \| undefined` | Получить функцию-резолвер напрямую                    |
| `getValueStateResolverIds(): string[]`                       | Список всех зарегистрированных `id`                   |
| `resetValueStateResolvers()`                                 | Очистка реестра (для тестов)                          |

### Пороговый резолвер (`valueStateResolver.ts`)

| Функция                                               | Описание                                        |
| ----------------------------------------------------- | ----------------------------------------------- |
| `registerThresholdResolver(config): string`           | Зарегистрировать, вернуть `id`                  |
| `createThresholdResolver(config): ValueStateResolver` | Создать напрямую (также регистрирует в реестре) |

**Конфигурация:**

| Параметр        | Тип                                    | Описание                                          |
| --------------- | -------------------------------------- | ------------------------------------------------- |
| `thresholds`    | `Array<number \| ThresholdDefinition>` | Пороговые значения                                |
| `states`        | `State[]`                              | Состояния сегментов (`thresholds.length + 1` шт.) |
| `invalidState?` | `State`                                | Для невалидных значений. По умолчанию `"none"`    |

### Фиксированный резолвер (`fixedValueStateResolver.ts`)

| Функция                                           | Описание                                        |
| ------------------------------------------------- | ----------------------------------------------- |
| `registerFixedResolver(config): string`           | Зарегистрировать, вернуть `id`                  |
| `createFixedResolver(config): ValueStateResolver` | Создать напрямую (также регистрирует в реестре) |

**Конфигурация:**

| Параметр         | Тип                     | Описание                                         |
| ---------------- | ----------------------- | ------------------------------------------------ |
| `entries`        | `Record<string, State>` | Маппинг: значение → State                        |
| `fallbackState?` | `State`                 | Для значений вне маппинга. По умолчанию `"none"` |

## Типы

```ts
// Общие
type ValueStateResolver = (value: unknown) => State;

// Пороговый резолвер
type ThresholdBoundary = "lower" | "upper";

interface ThresholdDefinition {
	value: number;
	boundary?: ThresholdBoundary; // по умолчанию "upper"
}

interface ThresholdValueStateResolverConfig {
	thresholds: Array<number | ThresholdDefinition>;
	states: State[];
	invalidState?: State;
}

// Фиксированный резолвер
interface FixedValueStateResolverConfig {
	entries: Record<string, State>;
	fallbackState?: State;
}
```

## Пороговый резолвер: алгоритм

Пороги делят числовую ось на `N + 1` сегмент, где `N` — количество порогов.
Каждому сегменту соответствует один `State` из массива `states`.

```
          порог 60           порог 95
             │                   │
  сегмент 0  │    сегмент 1      │  сегмент 2
  "warning"  │    "success"      │  "error"
─────────────┼───────────────────┼──────────────→ числовая ось
```

Шаги:

1. `""`, `null`, `undefined` → `invalidState`
2. Приведение к числу через `+value`
3. Не `isFinite` → `invalidState`
4. Проход по порогам:
    - `boundary: "upper"` (по умолчанию): `value < порог` → нижний сегмент
    - `boundary: "lower"`: `value <= порог` → нижний сегмент
5. Ни один порог не сработал → последний сегмент

## Фиксированный резолвер: алгоритм

1. `null`, `undefined` → `fallbackState`
2. Приведение к строке через `String(value)`
3. Lookup в `Map<string, State>` → найден → соответствующий State
4. Не найден → `fallbackState`

## Настройка границ (boundary)

По умолчанию пороговое значение включено в **верхний** сегмент (`boundary: "upper"`).

```ts
// Сегменты: (−∞, 60) и [60, +∞)
const resolve = createThresholdResolver({
	thresholds: [60],
	states: ["warning", "success"]
});
resolve(60); // → "success" ← включён в верхний

// Сегменты: (−∞, 60] и (60, +∞)
const resolve2 = createThresholdResolver({
	thresholds: [{ value: 60, boundary: "lower" }],
	states: ["warning", "success"]
});
resolve2(60); // → "warning" ← включён в нижний
```

Границы можно комбинировать:

```ts
const resolve = createThresholdResolver({
	thresholds: [{ value: 60, boundary: "lower" }, 95],
	states: ["warning", "success", "error"]
});
resolve(60); // → "warning"
resolve(95); // → "error"
```

## Примеры

### Типичный сценарий с таблицей

```ts
// 1. Конфигуратор при загрузке регистрирует резолверы из JSON-конфига
for (const [columnId, config] of Object.entries(columnConfigs)) {
	if (config.type === "threshold") {
		columnResolverIds[columnId] = registerThresholdResolver(config);
	} else if (config.type === "fixed") {
		columnResolverIds[columnId] = registerFixedResolver(config);
	}
}

// 2. В ячейке таблицы — единый вызов, тип резолвера не важен
const state = resolveValueState(column.valueStateResolverId, cellValue);
```

### Разрыв между диапазонами

```ts
const id = registerThresholdResolver({
	thresholds: [60, 70, 80, 95],
	states: ["warning", "success", "none", "success", "error"]
});
// 70–80 — нейтральная зона ("none")
```

### Фиксированный резолвер с числовыми значениями

```ts
const id = registerFixedResolver({
	entries: { "1": "success", "2": "warning", "3": "error" },
	fallbackState: "information"
});
resolveValueState(id, 1); // → "success" (число 1 → String → "1")
resolveValueState(id, 999); // → "information" (fallback)
```

## Реестр и идентификаторы

### Генерация id

`id` — хеш (djb2 → base36) от канонической строки конфигурации с префиксом `id_`.
Формат: `id_<символы>`, например `id_1kf5g2r`.

Канонические строки разделены по типу резолвера:

- Пороговый: `"threshold|60:upper,95:upper|warning,success,error|none"`
- Фиксированный: `"fixed|01:success,02:warning,03:error|none"`

### Дедупликация

- Идентичные конфигурации → один `id` и одна функция-резолвер
- Порядок порогов не важен (автосортировка)
- Порядок ключей в `entries` не важен (алфавитная сортировка)
- `register*` и `create*` разделяют один реестр

### Стабильность

`id` детерминирован — при повторной инициализации из того же конфига генерируются те же `id`.

## Нюансы реализации

### Приведение типов (пороговый)

Резолвер принимает `unknown` и приводит к числу через `+value`.
`""`, `null`, `undefined` перехватываются **до** приведения (т.к. `+""` и `+null` дают `0`).

### Приведение типов (фиксированный)

Значение приводится к строке через `String(value)`.
`null` и `undefined` возвращают `fallbackState` без приведения.

### Валидация (пороговый)

- `states.length !== thresholds.length + 1` → `Error`
- Дублирующиеся пороги → `console.warn`

### Производительность

- Пороговый: замыкание с примитивными массивами, `O(N)` по порогам
- Фиксированный: `Map.get()`, `O(1)`
- `resolveValueState`: один lookup в `Map` + вызов замыкания
