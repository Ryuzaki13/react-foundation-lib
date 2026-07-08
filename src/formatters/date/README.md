# Модуль форматирования дат

Утилитарный модуль для форматирования, парсинга и простых календарных операций в "плавающей" календарной семантике.
Человекочитаемые форматы строятся на заранее созданных `Intl.DateTimeFormat`, чтобы переиспользовать formatter в больших таблицах и не создавать `Intl` на каждый вызов.

## Ключевая идея

Модуль намеренно не пересчитывает входные значения по timezone клиента. Для него важны видимые календарные компоненты:

- год
- месяц
- день
- часы
- минуты
- секунды

Например, строка `2026-03-03T18:03:50Z` будет трактоваться как "03.03.2026 18:03:50", а не как локально пересчитанное время браузера.

В настройках `Intl` поля `timeZone` и `timeZoneName` намеренно игнорируются. Даже если пользовательская предустановка передаст их явно, форматирование не должно сдвигать календарные компоненты и не должно выводить `GMT`/`UTC`-метку.

Это поведение одинаково важно для:

- ISO-строк с timezone
- OData ticks и OData literals
- timestamp-значений
- ручного форматирования через пресеты

## Что умеет модуль

- форматировать даты и диапазоны
- нормализовать `Date | null | [Date | null, Date | null]` в диапазон `Date`
- парсить вход из `unknown`
- разбирать даты по пользовательскому шаблону
- приводить результат парсинга к `Date | null`
- хранить и переопределять именованные пресеты форматирования
- выполнять базовые календарные операции без timezone-сдвига

## Поддерживаемые входы

- `Date`
- `number` с Unix timestamp в секундах или миллисекундах
- ISO local: `2026-03-03`, `2026-03-03T18:03:50.327`
- ISO zoned: `2026-03-03T18:03:50Z`, `2026-03-03T18:03:50+05:00`
- OData ticks: `/Date(1772524230327)/`, `/Date(1772513430327+0300)/`
- OData literals: `datetime'2026-03-03T18:03:50'`, `datetimeoffset'2026-03-03T18:03:50Z'`
- ABAP compact: `20260303`
- ABAP dotted: `03.03.2026`
- slash-date: `03/03/2026`
- ISO-8601 duration: `PT2H30M`, `P1DT2H3M4S`

## Встроенные пресеты

- `date`: `dd.MM.yyyy`
- `datetime`: `dd.MM.yyyy HH:mm`
- `datetime-seconds`: `dd.MM.yyyy HH:mm:ss`
- `time`: `HH:mm`
- `time-seconds`: `HH:mm:ss`
- `date-short`: `03.03.2026`
- `date-medium`: `3 мар. 2026 г.`
- `date-long`: `3 марта 2026 г.`
- `month-short`: `3 мар.`
- `month-long`: `3 марта`
- `time-short`: `18:03`
- `time-medium`: `18:03:50`
- `time-long`: `18:03:50`
- `datetime-short`: `03.03.2026, 18:03`
- `datetime-medium`: `3 мар. 2026 г., 18:03:50`
- `datetime-long`: `3 марта 2026 г., 18:03:50`
- `odata-date`: `yyyy-MM-dd`
- `odata-datetime`: `yyyy-MM-ddTHH:mm:ss`
- `abap-date`: `yyyyMMdd`
- `abap-datetime`: `yyyyMMddHHmmss`

Style-пресеты используют `Intl.DateTimeFormat` с `ru-RU`, но время описано явными полями. Это важно для `long`: стандартный `timeStyle: "long"` добавляет timezone, а в этом модуле timezone-семантика запрещена.

Значения по умолчанию для любого пресета:

```ts
{
	locale: "ru-RU",
	intlOptions: { day: "2-digit", month: "2-digit", year: "numeric" },
	invalidFallback: ""
}
```

## Быстрый старт

```ts
import { formatDate, formatDateAsDateTime, formatDateRange, normalizeDateRange } from "@/shared/lib";

formatDate("2026-03-03T18:03:50.327Z", "datetime");
// "03.03.2026 18:03"

formatDateAsDateTime("/Date(1772524230327)/");
// "03.03.2026 18:03"

formatDateRange("2026-03-03T18:03:50Z", "2026-03-04T05:20:00+03:00", "datetime");
// "03.03.2026 18:03 - 04.03.2026 05:20"

normalizeDateRange(new Date(2026, 2, 3, 18, 3));
// [Date(2026-03-03 00:00:00), Date(2026-03-03 23:59:59)]
```

## Форматирование

### `formatDate`

Универсальный вход в форматирование.

```ts
import { formatDate } from "@/shared/lib";

formatDate("20260303", "date");
// "03.03.2026"

formatDate("2026-06-25", "month-short");
// "25 июн."

formatDate("datetimeoffset'2026-03-03T18:03:50.327Z'", "datetimeSeconds");
// "03.03.2026 18:03:50"
```

Можно передавать не только имя пресета, но и объект пресета:

```ts
formatDate("2026-03-03T18:03:50", {
	name: "machine",
	pattern: "yyyy-MM-ddTHH:mm:ss",
	locale: "ru-RU",
	invalidFallback: ""
});
// "2026-03-03T18:03:50"
```

Для человекочитаемых форматов лучше передавать `intlOptions`. Такой объект будет скомпилирован один раз и переиспользован через внутренний `WeakMap`, если переиспользуется сама ссылка на объект:

```ts
import type { DateFormatPreset } from "@/shared/lib";

const monthDatePreset = {
	name: "month-date",
	locale: "ru-RU",
	intlOptions: { day: "numeric", month: "long" },
	invalidFallback: ""
} satisfies DateFormatPreset;

formatDate("2026-03-03T18:03:50Z", monthDatePreset);
// "3 марта"
```

Можно задать fallback:

```ts
formatDate("abc", "datetime", { fallback: "н/д" });
// "н/д"
```

### `formatDateAsDate`, `formatDateAsMonthLong`, `formatDateAsDateTime`, `formatDateAsTime`

Упрощённые helper-обёртки поверх встроенных пресетов:

```ts
import { formatDateAsDate, formatDateAsDateTime, formatDateAsMonthLong, formatDateAsTime } from "@/shared/lib";

formatDateAsDate("2026-03-03T18:03:50Z");
// "03.03.2026"

formatDateAsMonthLong("2026-03-03T18:03:50Z");
// "3 марта"

formatDateAsDateTime("2026-03-03T18:03:50Z");
// "03.03.2026 18:03"

formatDateAsTime("2026-03-03T18:03:50Z");
// "18:03"
```

### `formatDateRange`

Форматирует две даты в строку вида `start - end`.

```ts
import { formatDateRange } from "@/shared/lib";

formatDateRange("2026-03-03T18:03:50Z", "2026-03-03T22:10:00Z", "timeSeconds");
// "18:03:50 - 22:10:00"
```

### `normalizeDateRange`, `requireDateRange`

Нормализуют UI-значение диапазона в пару дат. Одиночная дата и частично заполненный диапазон превращаются в полный календарный день.
Пара дат всегда упорядочивается от меньшей к большей.

```ts
import { normalizeDateRange, requireDateRange } from "@/shared/lib";

normalizeDateRange(new Date(2026, 2, 3, 18, 3));
// [Date(2026-03-03 00:00:00), Date(2026-03-03 23:59:59)]

normalizeDateRange([new Date(2026, 2, 5, 18, 3), new Date(2026, 2, 3, 5, 20)]);
// [Date(2026-03-03 00:00:00), Date(2026-03-05 23:59:59)]

normalizeDateRange([new Date(2026, 2, 5, 18, 3), new Date(2026, 2, 3, 5, 20)], { timeMode: "preserve" });
// [Date(2026-03-03 05:20:00), Date(2026-03-05 18:03:00)]

normalizeDateRange(null);
// null

requireDateRange(null);
// Error: Диапазон дат не задан
```

### Форматирование `duration`

`duration` поддерживается только для time-шаблонов. Если шаблон содержит токены даты, вернётся fallback.

```ts
formatDate("PT2H30M", "time");
// "02:30"

formatDate("P1DT2H3M4S", "timeSeconds");
// "26:03:04"

formatDate("PT12H", "date", { fallback: "н/д" });
// "н/д"
```

## Парсинг

### `parseDateValue`

Возвращает подробный результат с признаком типа:

```ts
import { parseDateValue } from "@/shared/lib";

parseDateValue("2026-03-03T18:03:50Z");
// {
//   kind: "date-time",
//   source: "iso-zoned",
//   date: Date
// }

parseDateValue("PT2H30M");
// {
//   kind: "duration",
//   source: "iso-duration",
//   durationMs: 9000000
// }
```

Источники `source` для `kind: "date-time"`:

- `date-object`
- `timestamp`
- `odata-ticks`
- `odata-literal`
- `abap-compact`
- `abap-dotted`
- `slash-date`
- `iso-local`
- `iso-zoned`

`null` возвращается для:

- `null` и `undefined`
- пустых строк
- строк `"null"` и `"undefined"`
- невалидных `Date`
- неподдерживаемых типов
- битых дат и duration-строк

### `parseDateByPattern`

Парсит строку по пользовательскому шаблону с токенами:

- `dd`
- `MM`
- `yyyy`
- `yy`

```ts
import { parseDateByPattern } from "@/shared/lib";

parseDateByPattern("03/03/2026", "dd/MM/yyyy");
// { kind: "date-time", source: "iso-local", date: Date }

parseDateByPattern("03-03-69", "dd-MM-yy");
// 03.03.2069

parseDateByPattern("03+03+2026", "dd+MM+yyyy");
// 03.03.2026
```

Если `value` не строка, `parseDateByPattern` делегирует обработку в `parseDateValue`.

## Обёртки с результатом `Date | null`

### `parseDate`

Если нужен не подробный объект, а сразу `Date | null`, используй эту обёртку:

```ts
import { parseDate } from "@/shared/lib";

parseDate("2026-03-03T18:03:50Z");
// Date(2026-03-03 18:03:50)

parseDate("PT2H30M");
// Date(1970-01-01 02:30:00)
```

Для `duration` модуль строит `Date` из длительности без timezone-сдвига, сохраняя видимые UTC-компоненты. Это удобно для унификации API, но важно помнить: длительность и календарная дата не одно и то же.

Например:

- `PT2H30M` можно безопасно представить как `01.01.1970 02:30`
- `P1DT2H3M4S` уже становится календарной датой `02.01.1970 02:03:04`
- `PT30H` не сохраняет семантику "30 часов" как отдельную длительность, а превращается в календарное смещение

Если downstream-код должен различать дату и длительность, лучше использовать `parseDateValue`, а не `parseDate`.

## Работа с пресетами

### Просмотр пресетов

```ts
import { getDatePreset, getDatePresetNames } from "@/shared/lib";

getDatePresetNames();
// ["date", "datetime", "datetimeSeconds", "time", "timeSeconds"]

getDatePreset("datetime");
// { name: "datetime", pattern: "dd.MM.yyyy HH:mm", ... }
```

### Регистрация пользовательского пресета

```ts
import { formatDate, registerDatePreset } from "@/shared/lib";

registerDatePreset({
	name: "machine",
	pattern: "yyyy-MM-ddTHH:mm:ss"
});

formatDate("2026-03-03T18:03:50", "machine");
// "2026-03-03T18:03:50"
```

### Сброс пресетов и очистка кэша форматирования

```ts
import { clearDateFormatCache, resetDatePresets } from "@/shared/lib";

resetDatePresets();
clearDateFormatCache();
```

Обычно `clearDateFormatCache()` имеет смысл вызывать после массового изменения пресетов, если форматирование уже использовалось ранее.

## Календарные helper-функции

### `createCalendarDate`

Создаёт локальный `Date` без дополнительной timezone-семантики:

```ts
import { createCalendarDate } from "@/shared/lib";

createCalendarDate(2026, 2, 3, 18, 3, 50);
// 03.03.2026 18:03:50
```

Важно: месяц передаётся в формате JavaScript `Date`, то есть с нуля:

- `0` = январь
- `1` = февраль
- `2` = март

### Начало и конец периода

```ts
import { getEndOfDay, getStartOfDay, getStartOfMonth } from "@/shared/lib";

const value = new Date(2026, 2, 3, 18, 3, 50);

getStartOfDay(value);
// 03.03.2026 00:00:00

getEndOfDay(value);
// 03.03.2026 23:59:59

getStartOfMonth(value);
// 01.03.2026 00:00:00
```

### Сдвиг по календарю

```ts
import { addCalendarDays, addCalendarMonths, addCalendarYears } from "@/shared/lib";

const value = new Date(2026, 2, 3, 18, 3, 50);

addCalendarDays(value, 7);
addCalendarMonths(value, 1);
addCalendarYears(value, -1);
```

### Сравнение дат по календарному дню

```ts
import { isSameCalendarDay } from "@/shared/lib";

isSameCalendarDay(new Date(2026, 2, 3, 1, 0, 0), new Date(2026, 2, 3, 23, 59, 59));
// true
```

## Публичный API

Функции:

- `formatDate`
- `formatDateAsDate`
- `formatDateAsDateTime`
- `formatDateAsMonthLong`
- `formatDateAsMonthShort`
- `formatDateAsTime`
- `formatDateRange`
- `parseDateValue`
- `parseDateByPattern`
- `parseDate`
- `registerDatePreset`
- `getDatePreset`
- `getDatePresetNames`
- `resetDatePresets`
- `clearDateFormatCache`
- `createCalendarDate`
- `getStartOfDay`
- `getEndOfDay`
- `getStartOfMonth`
- `addCalendarDays`
- `addCalendarMonths`
- `addCalendarYears`
- `isSameCalendarDay`

Константы:

- `DATE_FORMAT_DEFAULTS`
- `DEFAULT_DATE_PRESET_NAMES`

Типы:

- `DateInputSource`
- `ParsedDateValue`
- `DateFormatPattern`
- `DateFormatPreset`
- `DateFormatPresetConfig`
- `FormatDateOptions`
