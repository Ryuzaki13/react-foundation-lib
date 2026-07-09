# Путеводитель по `@ryuzaki13/react-foundation-lib`

Библиотечный пакет нижнего технического слоя: здесь лежат чистые функции, общие React/browser hooks и сериализуемые runtime-контракты без знания конкретных features, widgets, pages или apps.

Пакет публикуется в npm как публичная библиотека, но его основная задача практическая: вынести повторно используемый `shared/lib` слой из собственных проектов автора и подключать его одинаково в нескольких host-приложениях. Это не универсальный набор утилит на все случаи жизни; контракты и состав модулей в первую очередь оптимизируются под семейство проектов, где поверх этого слоя используются `@ryuzaki13/react-foundation-api` и `@ryuzaki13/react-foundation-ui`.

`react-foundation-lib` является нижним пакетом в этой цепочке. Он не должен зависеть от `api` или `ui`; наоборот, `api` и `ui` используют его как общий технический фундамент.

## Установка

```bash
npm install @ryuzaki13/react-foundation-lib
```

Пакет распространяется как ESM и не открывает корневой импорт. Используйте только точечные entrypoints из `exports`:

```ts
import { formatDateAsDate } from "@ryuzaki13/react-foundation-lib/formatters";
import { createQueryClient } from "@ryuzaki13/react-foundation-lib/query-client";
import { buildODataFilter } from "@ryuzaki13/react-foundation-lib/odata-service";
import type { RowRecord } from "@ryuzaki13/react-foundation-lib/types";
```

Импорт вида `@ryuzaki13/react-foundation-lib` намеренно недоступен. Так consumer явно выбирает нужный модуль, а сборщик host-проекта не получает общий barrel со всем пакетом. Типы экспортируются теми же subpath entrypoints через `exports.types`.

## Peer-зависимости

Большинство внешних пакетов объявлены как optional peers. Это означает только то, что их не нужно ставить для каждого сценария. Если host использует entrypoint, который импортирует внешний пакет, совместимая peer-зависимость должна быть установлена в host-проекте.

| Entry point                                 | Что может потребоваться в host-проекте                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `formatters`, `array`, `utils`, `validators` | Обычно не требуют дополнительных runtime-зависимостей.                                                   |
| `hooks`, `dom`, `copy`, `media`, `pwa`       | `react`, если используются React hooks.                                                                 |
| `query-client`, `error-report`              | `@tanstack/react-query`, `@tanstack/query-persist-client-core`, `@tanstack/query-broadcast-client-experimental`. |
| `odata-service`                             | `zod`; отдельные helpers типизируются вокруг `@tanstack/react-query`.                                    |
| `odata`, `notifications`                    | `zustand`, для отдельных store-helpers также `immer`.                                                    |
| `table`                                     | `@tanstack/react-table` и `react` для selection hooks.                                                   |
| `virtualizer`                               | `@tanstack/react-virtual` и `react`.                                                                    |
| `hooks` search helpers                      | `@tanstack/react-router`.                                                                               |
| `hooks` DnD helpers                         | `@dnd-kit/core`, `@dnd-kit/sortable`.                                                                   |
| `hooks` floating/listbox и DOM references   | `@floating-ui/react`.                                                                                   |
| `excel`                                     | `write-excel-file`.                                                                                     |

Такая схема оставляет пакет библиотечным: зависимости не зашиваются в bundle, а host-приложение контролирует версии React, TanStack, Zod и других runtime-библиотек.

## Проверка пакета

Основные команды разработки:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Перед публикацией можно проверить полный npm-артефакт:

```bash
npm run pack:dry-run
```

## Содержание

- [Установка](#установка)
- [Peer-зависимости](#peer-зависимости)
- [Проверка пакета](#проверка-пакета)
- [Быстрый выбор модуля](#быстрый-выбор-модуля)
- [Форматирование и значения](#форматирование-и-значения)
- [OData, таблицы и экспорт](#odata-таблицы-и-экспорт)
- [Browser, React hooks и UI-поведение](#browser-react-hooks-и-ui-поведение)
- [Runtime, state и инфраструктура](#runtime-state-и-инфраструктура)
- [Низкоуровневые helpers](#низкоуровневые-helpers)

## Быстрый выбор модуля

| Нужно                                                  | Идти сюда                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Даты, диапазоны, ABAP/OData date literals              | [`formatters/date`](./src/formatters/date/index.ts), тесты: [`formatDate.test.ts`](./src/formatters/date/formatDate.test.ts), [`dateRange.test.ts`](./src/formatters/date/dateRange.test.ts)                                    |
| Числа, проценты, валютные числа, compact axis labels   | [`formatters/number`](./src/formatters/number/index.ts), тесты: [`formatNumber.test.ts`](./src/formatters/number/formatNumber.test.ts), [`parseNumber.test.ts`](./src/formatters/number/parseNumber.test.ts)                    |
| Строки, ФИО, телефон, leading zeros, SAP boolean       | [`formatters`](./src/formatters/index.ts), тесты: [`common.test.ts`](./src/formatters/common.test.ts), [`boolean.test.ts`](./src/formatters/boolean/boolean.test.ts), [`strings.test.ts`](./src/formatters/strings/strings.test.ts) |
| Runtime-форматирование ячеек таблицы                   | [`formatters/pipeline`](./src/formatters/pipeline/index.ts), тесты в [`formatters/pipeline`](./src/formatters/pipeline)                                                                                                     |
| OData metadata, filters, sorts, path, values           | [`odata-service`](./src/odata-service/index.ts), тесты в [`odata-service`](./src/odata-service)                                                                                                                             |
| Справочные code/text пары OData collections            | [`odata`](./src/odata/index.ts), тест: [`odata.test.ts`](./src/odata/odata.test.ts)                                                                                                                                         |
| TanStack Table helpers                                 | [`table`](./src/table/index.ts), тесты в [`table`](./src/table)                                                                                                                                                             |
| Tree table преобразования                              | [`tree-table`](./src/tree-table/index.ts), тесты в [`tree-table`](./src/tree-table)                                                                                                                                         |
| Excel export                                           | [`excel`](./src/excel/index.ts), тесты: [`excel.test.ts`](./src/excel/excel.test.ts), [`tableExport.test.ts`](./src/excel/tableExport.test.ts)                                                                                  |
| FileReader, изображения, base64 Blob                   | [`file`](./src/file/index.ts), [`binary`](./src/binary/index.ts)                                                                                                                                                            |
| DOM overlay, portal, focus, download                   | [`dom`](./src/dom/index.ts), тест: [`dom.test.tsx`](./src/dom/dom.test.tsx)                                                                                                                                                 |
| Debounce/throttle, DnD sensors, search params, listbox | [`hooks`](./src/hooks/index.ts), [`utils/keyboard.ts`](./src/utils/keyboard.ts)                                                                                                                                             |
| QueryClient, persistence, broadcast                    | [`query-client`](./src/query-client/index.ts), README: [`query-client/README.md`](./src/query-client/README.md)                                                                                                             |
| PWA service worker update и `x-sw-cache` policy        | [`pwa`](./src/pwa/index.ts), README: [`pwa/README.md`](./src/pwa/README.md)                                                                                                                                                 |
| Подстановки открытых границ диапазона                  | [`range-output`](./src/range-output/index.ts), тест: [`rangeOutput.test.ts`](./src/range-output/rangeOutput.test.ts)                                                                                                        |
| Unknown guards, className, stable stringify, clone     | [`validators`](./src/validators/index.ts), [`utils`](./src/utils/index.ts)                                                                                                                                                  |

## Форматирование и значения

### `formatters/date`

Файлы: [`formatters/date/index.ts`](./src/formatters/date/index.ts), подробный README: [`formatters/date/README.md`](./src/formatters/date/README.md).

Главная идея: модуль работает в плавающей календарной семантике. ISO/OData строки с timezone не пересчитываются в timezone клиента, а сохраняют видимые компоненты даты и времени.

Основной API:

| API                                                                                                                               | Когда использовать                                                           |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `formatDate`, `formatDateRange`                                                                                                   | Универсальное форматирование значения или диапазона по preset/object preset. |
| `formatDateAsDate`, `formatDateAsDateTime`, `formatDateAsTime`, `formatDateAsTimeSeconds`                                         | Быстрые обертки для типовых UI-форматов.                                     |
| `formatDateAsAbapDate`, `formatDateAsAbapDatetime`, `formatDateAsODataDate`, `formatDateAsODataDatetime`, `formatDateAsODataTime` | Машинные форматы для SAP/OData.                                              |
| `parseDateValue`, `parseDate`, `parseDateByPattern`, `parseDateByFormat`                                                          | Парсинг `unknown` в календарную дату или detailed parse result.              |
| `normalizeDateRange`, `requireDateRange`, `countCalendarDaysInDateRange`                                                          | UI-диапазоны: одиночная дата, частично заполненный range, порядок границ.    |
| `createCalendarDate`, `getStartOfDay`, `getEndOfDay`, `getStartOfWeek`, `addCalendarDays`, `isSameCalendarDay`                    | Календарная арифметика без timezone-сдвига.                                  |
| `registerDatePreset`, `getDatePreset`, `resolveDateFormatPreset`, `resetDatePresets`                                              | Реестр date presets.                                                         |
| `resolveMonthStartToYesterdayRange`, `resolveTodayRange`, `resolveYesterdayRange`, `resolveMonthAgoRange`                         | Относительные диапазоны для фильтров.                                        |

Поведение из тестов:

- пустые и невалидные значения дают fallback, по умолчанию пустую строку;
- `Date`, ISO, OData ticks/literals, ABAP compact `YYYYMMDD`, dotted/slash dates и ISO duration поддержаны;
- `normalizeDateRange` упорядочивает даты и по умолчанию расширяет до границ дня;
- `timeZone` и `timeZoneName` в `Intl`-preset намеренно игнорируются.

Тесты: [`formatDate.test.ts`](./src/formatters/date/formatDate.test.ts), [`parseDate.test.ts`](./src/formatters/date/parseDate.test.ts), [`dateRange.test.ts`](./src/formatters/date/dateRange.test.ts), [`calendarDate.test.ts`](./src/formatters/date/calendarDate.test.ts), [`relativeRanges.test.ts`](./src/formatters/date/relativeRanges.test.ts).

### `formatters/number`

Файлы: [`formatters/number/index.ts`](./src/formatters/number/index.ts), README: [`formatters/number/README.md`](./src/formatters/number/README.md).

Модуль форматирует числа через presets и кеширует `Intl.NumberFormat`. Это стандартный путь для таблиц, графиков и SAP-like строк.

Основной API:

| API                                                                                                                                                  | Когда использовать                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `formatNumber(value, presetOrName)`                                                                                                                  | Универсальный formatter по имени preset или объекту preset. |
| `formatNumberAsInteger`, `formatNumberAsDecimal*`, `formatNumberAsCurrency`, `formatNumberAsPercent`, `formatNumberAsPrice`, `formatNumberAsTonnage` | Типовые UI-форматы.                                         |
| `formatNumberAs*OrEmpty`                                                                                                                             | То же, но semantic zero отображается пустой строкой.        |
| `formatCompactNumber`, `formatNumberAsChartAxis`, `formatNumberAsChartTooltip`, `formatNumberAsCurrencyChartAxis`                                    | Compact-формат для осей и tooltip графиков.                 |
| `parseNumber`, `toFiniteNumber`, `toPositiveInteger`, `isPositiveValue`, `isZeroValue`                                                               | Чтение SAP-like чисел из `unknown`.                         |
| `registerNumberPreset`, `getNumberPreset`, `getNumberPresetNames`, `resetNumberPresets`, `clearFormatCache`                                          | Реестр presets и кеш formatter-ов.                          |

Поведение из тестов:

- строки с пробелами/NBSP/NNBSP, апострофами и запятой как decimal separator парсятся корректно;
- пустая строка в `formatNumber` становится `"0"`;
- invalid number форматируется как `"0"`;
- compact формат умеет `тыс`, `млн`, `млрд`, `трлн`, разные rounding modes и min threshold;
- `OrEmpty` скрывает только значения, которые реально парсятся как ноль.

Тесты: [`formatNumber.test.ts`](./src/formatters/number/formatNumber.test.ts), [`parseNumber.test.ts`](./src/formatters/number/parseNumber.test.ts).

### `formatters/strings`

Файлы: [`formatters/strings/index.ts`](./src/formatters/strings/index.ts).

| API                                                  | Поведение                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `normalizeText`                                      | Возвращает trimmed непустую строку или `undefined`.             |
| `normalizeTextWithFallback`, `normalizeRequiredText` | То же, но с fallback, по умолчанию `""`.                        |
| `normalizeTextToLower`                               | Trim + lowercase, пустое значение превращает в `""`.            |
| `toSafeString`                                       | `null`/`undefined` превращает в `""`, остальное через `String`. |
| `normalizeTextSpaces`                                | Схлопывает обычные пробелы, NBSP и narrow NBSP в один пробел.   |
| `stripInnerSpaces`                                   | Удаляет внутренние пробелы/NBSP/NNBSP, полезно для чисел.       |
| `stripLeadingZeros`                                  | Удаляет ведущие нули у целой строки-числа, сохраняя знак.       |
| `startsWithIgnoringZeros`                            | Сравнение prefix без учета ведущих нулей и регистра.            |
| `truncateText`                                       | Trim + обрезка с `...`; пустой ввод дает `undefined`.           |

Тесты: [`strings.test.ts`](./src/formatters/strings/strings.test.ts), [`normalizeText.test.ts`](./src/formatters/strings/normalizeText.test.ts).

### Общие форматтеры

Файл: [`formatters/index.ts`](./src/formatters/index.ts), тест: [`common.test.ts`](./src/formatters/common.test.ts).

| API                                 | Поведение                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `formatFullName`, `formatShortName` | Нормализуют ФИО: полная форма или `Фамилия И.О.`.                                                                                  |
| `formatPhone`, `clearPhone`         | Приводят российский номер к `+7` и форматируют только полный номер.                                                                |
| `normalizeLeadingZeros`             | Для числового значения добавляет leading zeros целой части при `fixed > 0`; invalid input возвращает как есть.                     |
| `normalizeLeadingZerosStrict`       | SAP-like вариант: понимает пробелы группировки и запятую, умеет удалять нули при `fixed < 0`, сохраняет `number` для number-входа. |

### `formatters/boolean`

Файлы: [`formatters/boolean/index.ts`](./src/formatters/boolean/index.ts), тест: [`boolean.test.ts`](./src/formatters/boolean/boolean.test.ts).

| API                | Поведение                                                     |
| ------------------ | ------------------------------------------------------------- |
| `parseAbapBoolean` | Только точное `"X"` считается `true`; все остальное `false`.  |
| `parseBoolean`     | Читает `true`, `x`, `1`, primitives; пустые значения `false`. |
| `toAbapBoolean`    | Возвращает `"X"` или `" "`; строка `"0"` считается false.     |

### `formatters/valueState`

Файлы: [`formatters/valueState/index.ts`](./src/formatters/valueState/index.ts), README: [`formatters/valueState/README.md`](./src/formatters/valueState/README.md).

Модуль вычисляет визуальный `State` (`none`, `information`, `success`, `warning`, `error`) по значению.

| API                                                                                                  | Когда использовать                    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `createThresholdResolver`, `registerThresholdResolver`                                               | Числовые диапазоны по порогам.        |
| `createFixedResolver`, `registerFixedResolver`                                                       | Точное совпадение строковых значений. |
| `resolveValueState`, `getValueStateResolver`, `getValueStateResolverIds`, `resetValueStateResolvers` | Единый реестр resolver-ов.            |
| `resolveValueStateClassName`                                                                         | CSS-класс по состоянию.               |
| `DEFAULT_VALUE_STATES`, `VALUE_STATE_COLOR_TOKENS`                                                   | Presentation constants.               |

Поведение из тестов: threshold требует `states.length === thresholds.length + 1`, fixed resolver приводит значение к строке, unknown resolver дает `none`, className строится централизованно.

Тесты: [`thresholdValueStateResolver.test.ts`](./src/formatters/valueState/thresholdValueStateResolver.test.ts), [`fixedValueStateResolver.test.ts`](./src/formatters/valueState/fixedValueStateResolver.test.ts), [`valueStateClassName.test.ts`](./src/formatters/valueState/valueStateClassName.test.ts).

### `formatters/pipeline`

Файлы: [`formatters/pipeline/index.ts`](./src/formatters/pipeline/index.ts).

Pipeline — runtime форматирования ячейки. Он принимает сериализуемый `FormattersPipelineConfig` версии `1`, валидирует `plan` или строит линейный plan из `graph`, компилирует executor и возвращает display-result.

Поддержанные шаги:

| Шаг                     | Что делает                                                |
| ----------------------- | --------------------------------------------------------- |
| `normalizeLeadingZeros` | Прогоняет значение через `normalizeLeadingZeros`.         |
| `rowBasedOverride`      | Подменяет значение из поля строки или формулы `rowBased`. |
| `resolveValueState`     | Вычисляет state и опциональную иконку.                    |
| `typedValueFormat`      | Форматирует по OData type/role через date/number/string.  |

Основной API:

| API                                                                                                     | Когда использовать                                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `normalizeFormattersPipelineConfig`                                                                     | Принять `unknown` конфиг и получить валидный clone или `undefined`. |
| `validateFormattersPipelineConfig`, `validateFormattersPipelinePlan`, `validateFormattersPipelineGraph` | Проверить config и получить errors/warnings/plan.                   |
| `compileFormattersPipelineExecutor`                                                                     | Скомпилировать executor конкретной колонки.                         |
| `compileFormattersPipelineRuntime`, `compileFormattersPipelineRuntimeFields`                            | Подготовить runtime-поля на construction-stage.                     |
| `formatPipelineDisplayValue`                                                                            | Получить финальное display-value без знания о конкретной таблице.   |
| `formatTypedCellValue`                                                                                  | Форматировать одиночное значение по `role/type`.                    |
| `collectFormattersPipelineDependencyIds`, `collectRuntimeFieldDependencyIds`                            | Собрать поля, которые надо добавить в query для renderer/pipeline.  |
| `cloneFormattersPipelineConfig`, `cloneFormatterPipelinePlanStep`, `rekey*`                             | Безопасно копировать и переименовывать сериализуемые configs.       |

Поведение из тестов:

- `plan` имеет приоритет над `graph`; если plan невалиден, есть попытка построить plan из graph;
- graph должен быть строго линейным `source -> ... -> sink`, без циклов и disconnected nodes;
- каждый шаг может встречаться не больше одного раза;
- `typedValueFormat` не может идти до `resolveValueState`;
- `rowBasedOverride` не применяется к totals-строкам в field-режиме, formula-режим для totals разрешен;
- для formula dependencies есть проверки out-of-range, unused dependencies и runtime warnings.

Тесты: [`validate.test.ts`](./src/formatters/pipeline/validate.test.ts), [`execute.test.ts`](./src/formatters/pipeline/execute.test.ts), [`runtime.test.ts`](./src/formatters/pipeline/runtime.test.ts), [`dependencies.test.ts`](./src/formatters/pipeline/dependencies.test.ts), [`clone.test.ts`](./src/formatters/pipeline/clone.test.ts), [`rekey.test.ts`](./src/formatters/pipeline/rekey.test.ts), [`normalize.test.ts`](./src/formatters/pipeline/normalize.test.ts).

### `formatters/rowBased`

Файлы: [`formatters/rowBased/index.ts`](./src/formatters/rowBased/index.ts), тест: [`rowBased.test.ts`](./src/formatters/rowBased/rowBased.test.ts).

Это маленький реестр формул для row-based override внутри pipeline.

| API                                                    | Поведение                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `createRowBasedFormatterContext`                       | Дает формуле `ctx.key(index)`, `ctx.value(index)`, `ctx.num(index)`, `rawValue`, `rowData`, `columnId`. |
| `createRowBasedFormatterRegistry`                      | Нормализует definitions, запрещает пустой и дублирующийся `id`.                                         |
| `getRowBasedFormatterList`, `getRowBasedFormatterById` | Чтение глобального реестра.                                                                             |

Встроенные формулы лежат в [`definitions`](./src/formatters/rowBased/definitions): `divideWhenAgFormatter`, `valueWhenFieldOrNull`, `divideWhenFieldOrNull`.

### `formulas`

Файлы: [`formulas/index.ts`](./src/formulas/index.ts), README: [`formulas/README.md`](./src/formulas/README.md).

Глобальный реестр клиентских формул таблицы для calculated/clientOnly measure-колонок.

| API                                          | Поведение                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `createTableFormulaContext`                  | Контекст `key/value/num(index)` по dependency keys.                                      |
| `compileTableFormula`                        | Компилирует formulaId + keys в executor; не кидает runtime errors наружу.                |
| `executeTableFormula`                        | Разовый запуск формулы.                                                                  |
| `createTableFormulaRegistry`                 | Нормализует definitions и запрещает дубли.                                               |
| `getTableFormulaList`, `getTableFormulaById` | Доступ к реестру.                                                                        |
| `validateTableFormulaDependencies`           | Проверяет наличие formula, доступность dependencies, out-of-range и unused dependencies. |

Поведение из тестов: невалидный результат формулы дает `invalid_result`, runtime exception дает `runtime_error`, отсутствующая формула дает `formula_not_found`.

Тесты: [`execute.test.ts`](./src/formulas/execute.test.ts), [`validate.test.ts`](./src/formulas/validate.test.ts), [`dublicates.test.ts`](./src/formulas/dublicates.test.ts), [`perf.runtime.test.ts`](./src/formulas/perf.runtime.test.ts).

### `date-segments`

Файл: [`date-segments/index.ts`](./src/date-segments/index.ts), тест: [`mask.test.ts`](./src/date-segments/mask.test.ts).

Утилиты для segmented date input.

| API                          | Поведение                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `parseDateSegmentMask`       | Разбирает маску в editable/literal сегменты.                                                        |
| `isEditableDateSegment`      | Type guard editable-сегмента.                                                                       |
| `dateToIndexedSegmentValues` | Преобразует `Date` в `Map<index, value>` по сегментам.                                              |
| `areAllDateSegmentsEmpty`    | Проверяет пустой ввод.                                                                              |
| `indexedSegmentsToDate`      | Строго собирает `Date`; отклоняет невозможные даты и время, умеет `defaultDate` для масок без даты. |

### `number-scale`

Файлы: [`number-scale/index.ts`](./src/number-scale/index.ts), тест: [`numberScale.test.ts`](./src/number-scale/numberScale.test.ts).

Математика числовых слайдеров и шкал.

| API                                                                                          | Поведение                                                                    |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `resolveNumberScaleBounds`                                                                   | Возвращает finite min/max, меняет местами если min > max, fallback `0..100`. |
| `clampNumberScaleValue`                                                                      | Ограничивает значение границами.                                             |
| `normalizeNumberScaleStep`                                                                   | Некорректный/нулевой/отрицательный step заменяет на `1`.                     |
| `prepareNumberScaleMarks`                                                                    | Фильтрует finite marks в границах, сортирует и дедуплицирует.                |
| `snapNumberScaleValueToStep`, `snapNumberScaleValueToMarks`, `snapNumberScaleValue`          | Привязка к step или marks.                                                   |
| `valueToNumberScalePercent`, `percentToNumberScaleValue`, `percentToSnappedNumberScaleValue` | Перевод value <-> percent с учетом marks.                                    |
| `getNumberScaleMarkPercent`, `findClosestNumberScaleMarkByPercent`, `offsetNumberScaleValue` | Позиционирование marks и keyboard offset.                                    |

### `currency`

Файл: [`currency/currency.ts`](./src/currency/currency.ts), тест: [`currency.test.ts`](./src/currency/currency.test.ts).

| API                                      | Поведение                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `resolveCurrencyModeFromODataParameters` | Читает общий параметр `p_curr`: `false -> internal`, `true -> rub`, иначе `null`.                              |
| `resolveCurrencyAwareLabel`              | Добавляет к подписи валютный суффикс из пары labels; если суффикс начинается с запятой, пробел не добавляется. |

Это не formatter денежных чисел. Для чисел используй `formatters/number`.

## OData, таблицы и экспорт

### `odata-service`

Файл: [`odata-service/index.ts`](./src/odata-service/index.ts). Это чистый слой metadata/value/filter helpers. Transport и fetch лежат в пакете `@ryuzaki13/react-foundation-api/odata`.

#### Metadata и path

| API                                                                    | Поведение                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `parseServiceMetadata`                                                 | Парсит OData V2 XML metadata в `ServiceMetadata`: entities, FunctionImports, columns, parameters. |
| `resolveMetadataColumnLabel`                                           | Label с fallback на id.                                                                           |
| `isForcedCodeTextId`, `isForcedCodeTextFamilyId`                       | Проектные исключения code/text пар.                                                               |
| `buildParameterEntries`                                                | Форматирует параметры по metadata, проверяет mandatory и maxLength.                               |
| `buildEntityParameters`, `buildEntityPath`, `buildEntityOperationPath` | Строят entity path с metadata-aware params и result navigation.                                   |
| `buildFunctionImportParameters`, `buildFunctionImportPath`             | Строят FunctionImport query string через `URLSearchParams`.                                       |
| `collectFilterableColumns`, `collectFilterableColumnsIds`              | Выбор filterable колонок из metadata.                                                             |

Тесты: [`parser.test.ts`](./src/odata-service/parser.test.ts), [`builder.test.ts`](./src/odata-service/builder.test.ts).

#### Значения и типы

| API                                                                                                                  | Поведение                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `odataFormatValue`                                                                                                   | Сериализует OData primitive с escaping, suffix-ами и date literals.    |
| `odataParseValue`, `odataParseValueByMetadata`                                                                       | Парсит number/boolean/date/string, учитывает `abapBooleanLike`.        |
| `odataTypeSchemas`, `isStringSafe`, `isNumberSafe`, `isBooleanSafe`, `isDateSafe`                                    | Zod-схемы и guards для OData primitives.                               |
| `defaultODataTypeValue`, `defaultControlTypeValue`                                                                   | Default value по OData/UI base type.                                   |
| `getBaseTypeFromODataType`                                                                                           | OData type -> `string/number/boolean/date`.                            |
| `createFormatter`, `createBooleanFormatter`, `createStringFormatter`, `createNumberFormatter`, `createDateFormatter` | Zod-validated formatter factories.                                     |
| `getFormattersFor`, `getFormattersForBaseType`, `getFormatter`, `getFormatterForBaseType`                            | Описания formatter-ов для UI.                                          |
| `isODataBooleanType`, `isODataNumericType`, `isODataIntegerType`, `isODataDateType`                                  | Type guards OData groups.                                              |
| `wrapODataParams`, `unwrapODataParams`                                                                               | Переход между flat params и `{ value }` shape; unwrap сортирует ключи. |
| `normalizeRangeValue`, `normalizeBaseValue`, `isBaseValue`                                                           | Нормализация UI input values.                                          |
| `unwrapODataQueryResult`                                                                                             | Снятие OData result wrapper.                                           |

Тесты: [`formatters.test.ts`](./src/odata-service/formatters.test.ts), [`typesValidation.test.ts`](./src/odata-service/typesValidation.test.ts), [`common.test.ts`](./src/odata-service/common.test.ts).

#### Фильтры и сортировки

| API                                                                                                                                 | Поведение                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `buildODataFilter`, `buildODataFilterRecursive`                                                                                     | Сериализуют `FilterExpression` в `$filter`.                           |
| `createFilter`, `createFilterEqual`, `createFilterEqualFalsy`, `createFilterContains`, `createFilterBetween`                        | Фабрики условий; массивы значений собираются через `or`.              |
| `mergeFilterExpressions`                                                                                                            | Объединяет непустые expressions через `and`.                          |
| `toggleSort`, `buildODataOrder`, `buildODataOrderBy`, `resolveEffectiveSorts`, `getSortIndicator`                                   | Sorting state и `$orderby`, с fallback на grouping.                   |
| `sanitizeFilterConditionGroup`, `sanitizeFilterBinding`, `sanitizeFilterDefinitions`, `sanitizeFilterValue`, `sanitizeFilterValues` | Нормализация сохраненных filter configs/values.                       |
| `normalizeDictionaryCodeKey`, `mergeFilterValuePatch`                                                                               | Нормализация dictionary key и точечное изменение значения фильтра.    |
| `resolveODataFilterDefinitionColumnIds`, `resolveODataFilterDefinitionActiveColumnIds`                                              | Какие физические колонки затрагивает filter definition.               |
| `compileFiltersToExpression`                                                                                                        | Compiled filter definitions + values -> `FilterExpression`.           |
| `flattenFilterValuesToODataDependencies`                                                                                            | Segment/tree filters -> dependencies для связанных справочников.      |
| `collapseChainedODataSegmentFilterValues`                                                                                           | В цепочке OData-сегментов оставляет самый глубокий выбранный segment. |
| `isSqlFilterScalarValue`, `assertSqlFilterFieldId`, `buildSqlFilter`, `createSqlFilterEqual`, `createSqlFilterIn`                   | Legacy SQL-like WHERE payload, не OData `$filter`.                    |

Важно: `buildSqlFilter` специально запрещает опасные field id и требует заранее форматировать `Date`. Не используй его для Gateway URL.

Тесты: [`filters.test.ts`](./src/odata-service/filters.test.ts), [`filterDefinitions.test.ts`](./src/odata-service/filterDefinitions.test.ts), [`sorts.ts`](./src/odata-service/sorts.ts), [`sqlFilters.test.ts`](./src/odata-service/sqlFilters.test.ts).

### `range-output`

Файлы: [`range-output/index.ts`](./src/range-output/index.ts), тест: [`rangeOutput.test.ts`](./src/range-output/rangeOutput.test.ts).

| API                            | Поведение                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `readRangeOutputValueFallback` | Читает сериализуемые подстановки `start/end` из объекта с `outputValueFallback` через переданный парсер. |
| `resolveRangeOutputValue`      | Заменяет `null` в открытых границах диапазона на заданные подстановочные значения для внешней передачи.  |

### `odata`

Файлы: [`odata/index.ts`](./src/odata/index.ts), тест: [`odata.test.ts`](./src/odata/odata.test.ts).

| API                                                | Поведение                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `buildSeparatedArrays`                             | Из одной коллекции строит отдельные массивы code/text для каждой пары, дедуплицирует и сортирует. |
| `findCollectionPairs`                              | Ищет пары `code` + `*_txt/_text/_t`, поддерживает custom suffixes.                                |
| `ODataDateFormat`                                  | Форматирует `Date` в `datetime'...'`, `datetimeoffset'...'`, `time'...'`.                         |
| `useODataCollectionStore`, `odataCollectionConfig` | Zustand-store настроек коллекции: pagination, search, selected, dependent filters.                |

### `table`

Файлы: [`table/index.ts`](./src/table/index.ts), тесты в [`table`](./src/table).

| API                                                                                                          | Поведение                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `resolveTableColumnOrder`                                                                                    | Сначала сохраненный order, потом новые ids; дубли и неизвестные ids удаляются. |
| `buildTableColumnLayout`                                                                                     | Делает `{ id, width }`, ширина привязана к id, не позиции.                     |
| `normalizeTableColumnOrder`                                                                                  | Удаляет пустые и повторяющиеся column id.                                      |
| `reorderTableHeaderColumns`, `resolveReorderedTableHeaderColumns`                                            | Drag reorder только top-level header columns; locked/pinned не двигаются.      |
| `normalizeTableColumnWidth`, `normalizeTableColumnSizing`, `patchTableColumnWidth`, `removeTableColumnWidth` | Column sizing с min width, default `60`.                                       |
| `pruneTableRowSelection`, `toggleTableRowSelection`                                                          | `none`, `single`, `multi`; single не снимается повторным кликом.               |
| `useTableRowSelection`                                                                                       | Hook поверх selection helpers.                                                 |
| `resolveTableColumnFormattingContextFromODataColumn`                                                         | OData column -> pipeline context; numeric types force measure.                 |
| `createTableColumnVisibilityFromODataMetadata`                                                               | Стартовая visibility; code скрывается, если есть text-пара.                    |
| `createTableColumnsFromODataMetadata`                                                                        | Генерация TanStack columns из metadata.                                        |
| `enrichTableColumnsWithODataFormatting`                                                                      | Рекурсивно дозаполняет leaf columns formatting metadata.                       |
| `resolveStableColumnId`                                                                                      | `id` или строковый `accessorKey`.                                              |
| `getTableColumnMeta`, `getTableColumnFormattingMeta`, `resolveTableLength`, `isTableInteractiveElement`      | Маленькие runtime helpers для таблиц.                                          |

Тесты: [`columnLayout.test.ts`](./src/table/columnLayout.test.ts), [`columnOrder.test.ts`](./src/table/columnOrder.test.ts), [`columnSizing.test.ts`](./src/table/columnSizing.test.ts), [`selection.test.ts`](./src/table/selection.test.ts), [`odataAdapter.test.ts`](./src/table/odataAdapter.test.ts), [`utils.test.ts`](./src/table/utils.test.ts).

### `tree-table`

Файлы: [`tree-table/index.ts`](./src/tree-table/index.ts).

| API                                 | Поведение                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `buildTreeTableRows`                | Строит дерево из flat rows, поднимает сирот/самоссылки в root, не зацикливается, дубли id игнорирует после первого. |
| `transposeFlatRowsToTreeTableRows`  | Создает synthetic group rows из backend-колонок уровней и оставляет backend rows листьями.                          |
| `TREE_TABLE_TRANSPOSED_*` constants | Служебные поля transposed rows.                                                                                     |

Тесты: [`buildTreeTableRows.test.ts`](./src/tree-table/buildTreeTableRows.test.ts), [`transposeFlatRowsToTreeTableRows.test.ts`](./src/tree-table/transposeFlatRowsToTreeTableRows.test.ts).

### `excel`

Файлы: [`excel/index.ts`](./src/excel/index.ts).

| API                              | Поведение                                                             |
| -------------------------------- | --------------------------------------------------------------------- |
| `resolveExcelCellStyleFromState` | Проектный `State` -> text color для Excel.                            |
| `buildExcelAutoFilterRef`        | Диапазон `A1:C10`; пустая сетка дает `undefined`.                     |
| `buildExcelSheetData`            | Header bold + border, значения приводятся к типу Excel-ячейки.        |
| `downloadExcelFile`              | Формирует `.xlsx` через `write-excel-file`, умеет autoFilter feature. |
| `resolveTableExcelColumnType`    | OData type/role/clientOnly -> Excel constructor type.                 |
| `createTableExcelColumn`         | Column descriptor -> Excel column + number/date format.               |
| `downloadResolvedExcelTable`     | Скачивает уже подготовленную таблицу и прокидывает cell styles.       |

Тесты: [`excel.test.ts`](./src/excel/excel.test.ts), [`tableExport.test.ts`](./src/excel/tableExport.test.ts).

### `file` и `binary`

Файлы: [`file/index.ts`](./src/file/index.ts), README: [`file/README.md`](./src/file/README.md); [`binary/index.ts`](./src/binary/index.ts), README: [`binary/README.md`](./src/binary/README.md).

`file`:

| API                                                                                           | Поведение                                                                                                  |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `readFile`                                                                                    | FileReader wrapper: `data-url` или `array-buffer`, `allowedMime`, `maxBytes`, `AbortSignal`, typed result. |
| `buildMeta`, `attachAbort`, `assertValidAllowedMime`, `assertValidAccept`, `assertNotAborted` | Низкоуровневые helpers чтения файла; обычно нужны тестам или расширению `readFile`.                        |
| `ReadFileError`                                                                               | Ошибки чтения/валидации файла с code.                                                                      |
| `readImageFile`                                                                               | Надстройка для изображений: `image/*`, typed `allowedMime`, dimensions в data-url режиме.                  |
| `ReadImageError`                                                                              | Ошибки чтения изображения.                                                                                 |

`binary`:

| API              | Поведение                                                                      |
| ---------------- | ------------------------------------------------------------------------------ |
| `binaryToBlob`   | Base64/data URL/raw binary string -> `Blob`; валидирует пустые и битые данные. |
| `detectMimeType` | MIME по filename, data URL, byte signature, fallback `application/pdf`.        |
| `useBinaryFile`  | Hook: base64 string -> `{ blob, mime }` или error; object URL не создает.      |

Тест: [`binaryToBlob.test.ts`](./src/binary/binaryToBlob.test.ts).

### `xml`

Файл: [`xml/xml.ts`](./src/xml/xml.ts), тест: [`xml.test.ts`](./src/xml/xml.test.ts).

| API              | Поведение                                             |
| ---------------- | ----------------------------------------------------- |
| `escapeXmlValue` | Экранирует `& < > " '`, `null/undefined` -> `""`.     |
| `buildXmlFields` | Собирает компактные XML tags без переносов.           |
| `getXmlTagText`  | DOMParser + trimmed text первого tag или `undefined`. |

## Browser, React hooks и UI-поведение

### `dom`

Файлы: [`dom/index.ts`](./src/dom/index.ts), тест: [`dom.test.tsx`](./src/dom/dom.test.tsx).

| API                                                                         | Поведение                                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `getOrCreatePortalRoot`                                                     | Создает portal root один раз и переиспользует HTMLElement.                                     |
| `downloadFileFromObjectURL`, `downloadFileFromBlob`, `downloadFileFromJson` | Скачивание через `<a download>`, object URL освобождается после click.                         |
| `useClickOutside`                                                           | Mousedown outside одного или нескольких refs.                                                  |
| `useEscapeDismiss`                                                          | Escape закрывает только активный overlay; если задан `containerRef`, фокус должен быть внутри. |
| `useOverlayFocus`                                                           | Initial focus, optional focus trap, restore focus.                                             |
| `useFocusTrap`                                                              | Совместимый wrapper поверх `useOverlayFocus`.                                                  |
| `useElementHeightObserver`                                                  | Height через `ResizeObserver`.                                                                 |
| `useIntersectionObserver`                                                   | Boolean пересечения элемента.                                                                  |
| `useIsTouchDevice`                                                          | Coarse pointer / touch / `maxTouchPoints`, обновление на resize.                               |

### `hooks`

Файлы: [`hooks/index.ts`](./src/hooks/index.ts).

| API                     | Поведение                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `useDebounce`           | Debounced value через timeout.                                                               |
| `useDebouncedCallback`  | Last-write-wins callback, `call/flush/cancel`, optional `flushOnUnmount`.                    |
| `useThrottledCallback`  | Leading + trailing throttle, last-write-wins, `call/flush/cancel`.                           |
| `useDndSortableSensors` | Общие PointerSensor + KeyboardSensor для sortable DnD, default distance `6`.                 |
| `useFloatingListbox`    | Floating UI listbox: open/close, active index, keyboard navigation, aria ids, focus restore. |
| `useSearchParams`       | Wrapper над TanStack Router `useSearch/useNavigate`, `replace: true`, allowed keys filter.   |
| `useSearchLink`         | Строит ссылку с измененными search params без ручного `window.location.search`.              |
| `useLazyComponent`      | Hook-обертка lazy component, если используется рядом с `createLazyComponent`.                |
| `useReferenceTrace`     | Диагностика изменения ссылок.                                                                |
| `useBlockBrowserZoom`   | Блокирует `ctrl+wheel` при enabled.                                                          |

### `copy`

Файлы: [`copy/index.ts`](./src/copy/index.ts).

| API                              | Поведение                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `useCopyText`                    | Clipboard API в secure context, fallback через `execCommand`; пустой текст не копирует. |
| `useElementText`                 | Trimmed `textContent` ref.                                                              |
| `useCopyElementText`             | Копирует текст из ref.                                                                  |
| `useCopyFeedback`                | `isCopied` на 2 секунды.                                                                |
| `useCopyElementTextWithFeedback` | Копирование элемента + feedback.                                                        |

### `media`

Файлы: [`media/index.ts`](./src/media/index.ts), тест: [`media.test.ts`](./src/media/media.test.ts).

| API                                                              | Поведение                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `BREAKPOINTS_EM`, `Breakpoint`, `MediaMatches`                   | Проектные брейкпоинты в `em`: mobile/tablet/laptop.                                |
| `useMatchMedia`                                                  | Singleton external store на `useSyncExternalStore`; учитывает изменение root `em`. |
| `ResponsiveValue`, `resolveResponsiveValue`, `resolveProps`      | Responsive props с fallback по брейкпоинтам.                                       |
| `getCurrentFontSize`, `getCurrentLineHeight`, `getControlHeight` | DOM font metrics с safe defaults.                                                  |
| `pxToEm`                                                         | px -> em строка.                                                                   |

### `context-menu`

Файлы: [`context-menu/index.ts`](./src/context-menu/index.ts), тесты: [`anchor.test.ts`](./src/context-menu/anchor.test.ts), [`state.test.ts`](./src/context-menu/state.test.ts).

| API                                                       | Поведение                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `getMenuPointFromEvent`                                   | `clientX/clientY` -> point.                                                        |
| `getMenuPointFromRect`                                    | Center point rect.                                                                 |
| `createVirtualAnchor`                                     | Virtual element для Floating UI.                                                   |
| `initialMenuState`, `openMenu`, `closeMenu`, `toggleMenu` | Immutable state helpers; `closeMenu` возвращает исходный объект, если уже закрыто. |

### `notifications`

Файлы: [`notifications/index.ts`](./src/notifications/index.ts), тест: [`store.test.ts`](./src/notifications/store.test.ts).

| API                        | Поведение                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `createNotificationsStore` | Zustand vanilla store, максимум 6 уведомлений, TTL timers, `push/update/upsert/dismiss/clear`.    |
| `bindNotifications`        | Привязка store к imperative `notify`.                                                             |
| `notify`                   | `push/upsert/update/dismiss/clear`, short methods `success/info/warning/error`, progress pattern. |

`notify` требует bound store; без provider будет ошибка.

### `pwa` и `virtualizer`

Файлы: [`pwa/index.ts`](./src/pwa/index.ts), README: [`pwa/README.md`](./src/pwa/README.md); [`virtualizer/index.ts`](./src/virtualizer/index.ts).

`pwa`:

| API                                                                                                        | Поведение                                                             |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `parseSwCachePolicy`, `buildSwCachePolicyValue`, `resolveSwCacheCacheNameByPolicy`, `normalizeSwCacheName` | Разбор `x-sw-cache`: `off`, `ttl=24h`, `bust=forever`, `max`, `name`. |
| `useServiceWorkerUpdate`                                                                                   | UI hook для service worker update flow.                               |

Service worker runtime helpers живут в [`pwa/serviceWorker.ts`](./src/pwa/serviceWorker.ts) и используются shell-слоем: registration, waiting worker, reload-chain guard, invalidate cache profile.

`virtualizer`:

| API                      | Поведение                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `useFetchNextPageEffect` | Общий эффект дозагрузки следующей страницы для virtualizer/infinite query сценариев. |

## Runtime, state и инфраструктура

### `query-client`

Файлы: [`query-client/index.ts`](./src/query-client/index.ts), README: [`query-client/README.md`](./src/query-client/README.md), optimistic guide: [`OPTIMISTIC_UPDATE.md`](./src/query-client/OPTIMISTIC_UPDATE.md).

| API                                                                                                    | Поведение                                                                            |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `createQueryClient`                                                                                    | Singleton QueryClient defaults: stale/gc, retry, error handlers, optional persister. |
| `persistedQueryMeta`, `shouldPersistQuery`, `createReactQueryPersister`, `createIndexedDbQueryStorage` | Opt-in persistence справочников в IndexedDB.                                         |
| `installReactQueryBroadcast`, `broadcastCacheEvent`, `setBroadcastFn`                                  | Sync query cache и cache events между вкладками.                                     |
| `onMutateOptimistic`, `onErrorOptimistic`, `onSuccessOptimistic`, `onSettledOptimistic`                | Helpers для точечного optimistic update.                                             |

Поведение из тестов: persistence сохраняет только `meta.persist === true`, broadcast игнорирует невалидные сообщения и не зацикливает remote events, `onSettledOptimistic` по умолчанию invalidates с `refetchType: "none"`.

Тесты: [`queryClient.test.ts`](./src/query-client/queryClient.test.ts), [`persistence.test.ts`](./src/query-client/persistence.test.ts), [`broadcast.test.ts`](./src/query-client/broadcast.test.ts), [`broadcast.integration.test.ts`](./src/query-client/broadcast.integration.test.ts).

### `error` и `error-report`

Файлы: [`error/index.ts`](./src/error/index.ts), [`error-report/index.ts`](./src/error-report/index.ts).

`error`:

| API                                                             | Поведение                                              |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `createMissingContextErrorMessage`, `createMissingContextError` | Единый текст ошибки для hooks, вызванных вне provider. |

`error-report`:

| API                                                                                                                                                                                           | Поведение                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `addErrorReportBreadcrumb`, `getErrorReportBreadcrumbs`, `clearErrorReportBreadcrumbs`, `installErrorReportBrowserBreadcrumbs`                                                                | Breadcrumb trail.                                             |
| `captureQueryErrorReport`, `captureMutationErrorReport`, `captureRuntimeErrorReport`                                                                                                          | Создание report payload.                                      |
| `collectQueryDiagnostics`, `collectMutationDiagnostics`, `collectQueryClientDiagnostics`, `collectPersistedQueryDiagnostics`                                                                  | Диагностика без тяжелых query data.                           |
| `createDiagnosticValue`, `createDataShape`, `sanitizeDetail`                                                                                                                                  | Safe JSON-compatible формы с отсечением секретов и глубины.   |
| `getErrorReportDraft`, `updateErrorReportDraft`, `getErrorReportDrafts`, `captureErrorReportDraft`                                                                                            | Draft-хранилище отчетов.                                      |
| `setErrorReportingDeliveryMode`, `getErrorReportingDeliveryMode`, `isErrorReportingEnabled`, `getErrorReportEnvironment`                                                                      | Environment/delivery config.                                  |
| `createErrorInfo`                                                                                                                                                                             | Нормализация unknown error в безопасный `message/name/stack`. |
| `setErrorReportRuntimeErrorReporter`, `reportRuntimeError`, `setErrorReportTransportErrorReporter`, `isTransportErrorReportScheduled`, `suppressTransportErrorReport`, `reportTransportError` | Интеграционные точки runtime/transport reporting.             |

Тесты: [`missingContextError.test.ts`](./src/error/missingContextError.test.ts), [`errorReport.test.ts`](./src/error-report/errorReport.test.ts), [`breadcrumbs.test.ts`](./src/error-report/breadcrumbs.test.ts).

## Низкоуровневые helpers

### `array`

Файлы: [`array/index.ts`](./src/array/index.ts), тесты: [`array.test.ts`](./src/array/array.test.ts), [`reorder.test.ts`](./src/array/reorder.test.ts).

| API                                                 | Поведение                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `arrayGroupBy`, `arrayGroupByToArray`               | Группировка по ключу, порядок элементов внутри группы сохраняется.         |
| `arrayToMap`                                        | Map-object по первому встреченному значению ключа.                         |
| `arrayUniqueBy`                                     | Дедупликация по ключу без перестановки первого значения.                   |
| `filterAndDeduplicateIds`                           | Оставляет только allowed ids, убирает пустые и дубли.                      |
| `appendMissingIds`                                  | Добавляет отсутствующие ids в конец базового списка.                       |
| `pickExistingMapValues`                             | Значения `Map` в порядке keys, отсутствующие ключи пропускаются.           |
| `arraysEqual`                                       | Строго по длине, порядку и ссылочным значениям.                            |
| `moveItem`, `moveArrayItem`, `moveArrayItemByIndex` | Immutable reorder; некорректные индексы возвращают копию без перестановки. |
| `normalizeObjects`                                  | Trim key, отсекает пустые/дубли, по умолчанию shallow copy.                |
| `normalizeStringArray`, `addUnique`                 | Нормализация string ids.                                                   |

### `utils`

Файлы: [`utils/index.ts`](./src/utils/index.ts), тесты: [`utils.test.ts`](./src/utils/utils.test.ts), [`keyboard.test.ts`](./src/utils/keyboard.test.ts), [`createLazyComponent.test.tsx`](./src/utils/createLazyComponent.test.tsx).

| API                                                                             | Поведение                                                                                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `cn`                                                                            | Сборка className из строк и conditional object. Новый код использует `cn`.                                |
| `stableStringify`                                                               | JSON с сортировкой object keys; подходит для cache keys/сравнений.                                        |
| `childrenCount`                                                                 | Считает React children, раскрывая fragments.                                                              |
| `createLazyComponent`                                                           | Кеширует lazy component по import function/componentName или explicit `cacheKey`.                         |
| `deepCopyWithoutFunctions`                                                      | Для plain config: удаляет функции, копирует Date/arrays/plain objects, unsupported objects кидают ошибку. |
| `deepCloneWithoutFunctions`                                                     | Более общий clone: Date, RegExp, Map, Set, cycles, sparse arrays, descriptors, optional prototype.        |
| `keyboardActivationKeys`, `isKeyboardActivationKey`, `handleKeyboardActivation` | Enter/Space activation для custom controls.                                                               |
| `getRovingFocusTargetIndex`                                                     | Home/End/Arrow navigation для roving focus.                                                               |
| `findFirstEnabledIndex`, `findLastEnabledIndex`, `findNextEnabledIndex`         | Navigation по listbox/select options с disabled и optional wrap.                                          |
| `deepCopyNodes`, `deepCopyTree`                                                 | Копирование tree nodes, custom children field.                                                            |
| `toBase64`, `encodeBase64`                                                      | Unicode-safe base64.                                                                                      |
| `logError`                                                                      | Косвенный `console.error`, который terser не удаляет.                                                     |

### `validators` и `types`

Файлы: [`validators/index.ts`](./src/validators/index.ts), [`types/index.ts`](./src/types/index.ts), тест: [`validators.test.ts`](./src/validators/validators.test.ts).

| API                                                                                                     | Поведение                                                   |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `isSafe`                                                                                                | Type guard от `null/undefined`.                             |
| `isObject`, `isRecord`, `asRecord`, `isPlainObject`                                                     | Guards для object-like values; массивы не считаются record. |
| `IMAGE_EXTENSIONS`, `isImageExtension`                                                                  | Проверка image extension без учета регистра.                |
| `isDomReference`                                                                                        | Floating UI reference -> DOM `Element`.                     |
| `State`, `AbapBoolean`, `Primitive`, `BaseType`, `InputType`, `RangeType`, `RowRecord` | Общие технические типы.                                     |

### `string-comparison`

Файл: [`string-comparison/compareStrings.ts`](./src/string-comparison/compareStrings.ts), тест: [`compareStrings.test.ts`](./src/string-comparison/compareStrings.test.ts).

`compareStrings` использует фиксированный `Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })` и UTF-16 fallback. Используй для справочников и UI-списков вместо ad hoc `localeCompare`.

### `crypto` и `session-storage`

Файлы: [`crypto/index.ts`](./src/crypto/index.ts), [`session-storage/index.ts`](./src/session-storage/index.ts).

| API                                                            | Поведение                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `hashString`                                                   | Компактный FNV-1a-like 32-bit hash base36.                                          |
| `hashString128`, `hashString128Base64Url`, `stringToElementId` | Стабильные длинные hash/id для DOM/cache-like ключей.                               |
| `uuidv4`                                                       | Native `crypto.randomUUID` или fallback через `getRandomValues`.                    |
| `getSessionStorageId`                                          | Стабильный id вкладочной сессии; fallback при недоступном/ошибочном sessionStorage. |

Тесты: [`crypto.test.ts`](./src/crypto/crypto.test.tsx), [`sessionId.test.ts`](./src/session-storage/sessionId.test.ts).

### `presets`

Файл: [`presets/presets.ts`](./src/presets/presets.ts), тест: [`presets.test.ts`](./src/presets/presets.test.ts).

| API                         | Поведение                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `normalizePresetIds`        | Unknown saved ids -> валидные ids через доменный type guard, fallback если вход не массив. |
| `resolvePresetOptionsByIds` | Options по ids с сохранением порядка и удалением дублей.                                   |
| `getPresetOption`           | Поиск option по id или `null`.                                                             |

### `bounded-copy-stack`

Файл: [`bounded-copy-stack/boundedCopyStack.ts`](./src/bounded-copy-stack/boundedCopyStack.ts), тест: [`boundedCopyStack.test.ts`](./src/bounded-copy-stack/boundedCopyStack.test.ts).

| API                               | Поведение                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `pushBoundedCopyStackItem`        | Добавляет item в начало, поднимает существующий fingerprint без дубля, ограничивает size. |
| `getBoundedCopyStackCandidates`   | Фильтрует элементы стека predicate-ом.                                                    |
| `DEFAULT_BOUNDED_COPY_STACK_SIZE` | Default size `3`.                                                                         |
