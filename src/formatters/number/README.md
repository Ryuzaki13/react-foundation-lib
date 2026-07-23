# Модуль форматирования чисел (presets)

Утилитарный модуль для форматирования чисел с системой предустановок.
Оптимизирован для массового вызова (500+ раз) — форматирование ячеек таблицы.

## Архитектура

- **Locale `ru-RU`** — неразрывный пробел для группировки, запятая для дробной части
- **Быстрый путь** (99% вызовов): `Intl.NumberFormat.format()` напрямую, без постобработки
- **Кеш** `Intl.NumberFormat` по ключу `(decimals, grouping)` — конструктор вызывается один раз
- **SAP-совместимость**: строки, пустые значения, ведущие нули
- **Неразрывный пробел** — числа не переносятся при рендере в DOM
- **Компактные пресеты** — короткое представление значений от `1 000` через `тыс`, `млн`, `млрд`, `трлн`

## Использование

```ts
import { formatNumber, registerPreset } from "@/shared/lib";

formatNumber(1234567, "Integer"); // "1 234 567" (неразрывные пробелы)
formatNumber(1234567.891, "Decimal"); // "1 234 567,9"
formatNumber(99.1, "Percent"); // "99,10"
formatNumber(1534000, "compact-currency"); // "1,5 млн"
formatNumber("00123.4", "Decimal"); // "123,4"
```

## API

### `formatNumber(value, presetOrName)`

| Параметр       | Тип                            | Описание                                           |
| -------------- | ------------------------------ | -------------------------------------------------- |
| `value`        | `number \| string`             | Число или строковое представление (SAP-совместимо) |
| `presetOrName` | `string \| NumberFormatPreset` | Имя предустановки или объект с параметрами         |

Можно передать объект напрямую, без регистрации:

```ts
formatNumber(1234567.891, {
	name: "custom",
	decimals: 3,
	decimalSeparator: ".",
	grouping: true,
	groupingSeparator: ",",
	groupingSize: 3
});
// "1,234,567.891"
```

### `registerPreset(config)` / `getPreset(name)` / `getPresetNames()`

```ts
registerPreset({ name: "Weight", decimals: 3, decimalSeparator: "." });
formatNumber(9876.5, "Weight"); // "9 876.500"
```

### `resetPresets()` / `clearFormatCache()`

Сброс реестра и кеша соответственно.

## Типовые предустановки

| Имя                      | decimals | decimalSeparator | Пример        |
| ------------------------ | -------- | ---------------- | ------------- |
| `Integer`                | 0        | —                | `1 234 567`   |
| `Decimal`                | 1        | `,`              | `1 234 567,9` |
| `Currency`               | 0        | —                | `5 000 000`   |
| `Price`                  | 0        | —                | `42 000`      |
| `Percent`                | 2        | `,`              | `99,10`       |
| `Tonnage`                | 1        | `,`              | `15 000,8`    |
| `compact-currency`       | 0        | —                | `1,5 млн`     |
| `compact-currency-round` | 0        | —                | `35 тыс`      |
| `compact-percent`        | 2        | `,`              | `12,34 тыс`   |
| `compact-percent-round`  | 2        | `,`              | `12,35 тыс`   |
| `compact-tonnage`        | 1        | `,`              | `9,5 млн`     |
| `compact-tonnage-round`  | 1        | `,`              | `9,6 млн`     |

Все типовые предустановки используют `grouping: true`, `groupingSeparator` — неразрывный пробел из `ru-RU`, `groupingSize: 3`.

Предустановки без суффикса `-round` усекают компактную часть к нулю. Это
поведение подходит для консервативных подписей шкалы. Парные предустановки
`compact-*-round` математически округляют компактную часть и предназначены
для случаев, где подпись должна отражать ближайшее значение.

## Значения по умолчанию (`FORMAT_DEFAULTS`)

| Свойство            | Значение        | Описание                  |
| ------------------- | --------------- | ------------------------- |
| `decimals`          | `1`             | Количество десятичных     |
| `decimalSeparator`  | `","`           | Разделитель дробной части |
| `grouping`          | `true`          | Группировка разрядов      |
| `groupingSeparator` | NBSP из `ru-RU` | Неразрывный пробел        |
| `groupingSize`      | `3`             | Размер группы             |

## Типы

```ts
interface NumberFormatPreset {
	name: string;
	decimals: number;
	decimalSeparator: string;
	grouping: boolean;
	groupingSeparator: string;
	groupingSize: number;
	compact?: NumberFormatCompactOptions;
}

type NumberFormatCompactOptions = {
	minCompactValue?: number;
	maxDecimals?: number;
	roundingMode?: "round" | "floor" | "ceil" | "trunc";
	suffixSeparator?: string;
	units?: readonly { value: number; suffix: string }[];
};

type NumberFormatPresetConfig = Partial<Omit<NumberFormatPreset, "name">> & Pick<NumberFormatPreset, "name">;
```

## Три ветки форматирования

1. **Стандартный ru-RU** (NBSP + запятая, groupingSize=3): `format()` напрямую
2. **Кастомные разделители** (groupingSize=3): `formatToParts()` + подстановка
3. **Нестандартный groupingSize**: Intl-округление + ручная группировка
