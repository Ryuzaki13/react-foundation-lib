# Даты, время и календарные диапазоны

Модуль решает четыре связанные задачи:

- парсит даты из JavaScript, ISO, OData и ABAP-представлений;
- форматирует их через встроенные или пользовательские presets;
- выполняет календарную арифметику без скрытого timezone-сдвига;
- строит обычные, относительные и учебные диапазоны дат.

Все функции и типы экспортируются через общий entrypoint:

```ts
import {
	formatDateAsDate,
	getCalendarPeriod,
	normalizeDateRange,
	parseDate,
	parseDateTZ
} from "@ryuzaki13/react-foundation-lib/formatters";
```

Импорта `@ryuzaki13/react-foundation-lib/formatters/date` нет.

## Самое важное: две timezone-семантики

Модуль различает календарные компоненты и абсолютный момент времени.

### Floating: сохранить видимые компоненты

Обычные `parseDateValue` и `parseDate` намеренно не пересчитывают ISO/OData timezone в timezone компьютера пользователя.

```ts
const date = parseDate("2026-03-03T18:03:50+05:00");

date?.getFullYear(); // 2026
date?.getMonth(); // 2, то есть март
date?.getHours(); // 18
```

Это полезно для календарных UI-значений: расписания, периода отчёта, дня документа, фильтра «с/по». Пользователь видит те компоненты, которые пришли от сервиса.

### Instant: сохранить реальный момент

`parseDateValueTZ` и `parseDateTZ` применяют явный timezone и сохраняют Unix instant:

```ts
const date = parseDateTZ("2026-03-03T18:03:50+05:00");

date?.toISOString(); // "2026-03-03T13:03:50.000Z"
```

Локальные getters такого `Date` зависят от timezone среды. Используйте TZ-вариант, когда значение означает настоящий момент события: timestamp аудита, время серверного события, instant для сортировки между часовыми поясами.

### Простое правило выбора

| Значение означает              | Использовать                           |
| ------------------------------ | -------------------------------------- |
| Видимую календарную дату/время | `parseDate`, `parseDateValue`          |
| Абсолютный момент времени      | `parseDateTZ`, `parseDateValueTZ`      |
| Строку для обычного UI         | `formatDate*` — внутри floating parser |

Не выбирайте вариант по наличию буквы `Z` во входе. Выбирайте по бизнес-смыслу данных.

## Быстрый старт

```ts
import { formatDateAsDate, formatDateAsDateTime, formatDateAsODataDate, parseDate } from "@ryuzaki13/react-foundation-lib/formatters";

formatDateAsDate("20260303"); // "03.03.2026"
formatDateAsDateTime("2026-03-03T18:03:00"); // "03.03.2026 18:03"
formatDateAsODataDate(new Date(2026, 2, 3)); // "2026-03-03"

const date = parseDate("03.03.2026"); // Date | null
```

Для невалидного значения formatter по умолчанию возвращает пустую строку:

```ts
formatDateAsDate("not-a-date"); // ""
formatDateAsDate("not-a-date", { fallback: "—" }); // "—"
```

## Поддерживаемые входы

`parseDateValue`/`parseDate` принимают `unknown`, но распознают только конкретные контракты.

| Источник          | Пример                          | `source` detailed-result |
| ----------------- | ------------------------------- | ------------------------ |
| `Date`            | `new Date(...)`                 | `date-object`            |
| Unix seconds      | `1_772_563_200`                 | `timestamp`              |
| Unix milliseconds | `1_772_563_200_000`             | `timestamp`              |
| OData v2 ticks    | `/Date(1772563200000+0500)/`    | `odata-ticks`            |
| OData literal     | `datetime'2026-03-03T18:03:50'` | `odata-literal`          |
| ABAP date         | `20260303`                      | `abap-compact`           |
| ABAP timestamp    | `20260303180350`                | `abap-timestamp`         |
| Dotted            | `03.03.2026`                    | `abap-dotted`            |
| Slash             | `03/03/2026`                    | `slash-date`             |
| ISO local         | `2026-03-03T18:03:50`           | `iso-local`              |
| ISO zoned         | `2026-03-03T18:03:50Z`          | `iso-zoned`              |
| ISO duration      | `PT02H30M`                      | `iso-duration`           |

Slash-формат интерпретируется как `MM/DD/YYYY`, а не `DD/MM/YYYY`:

```ts
parseDate("12/31/2026"); // 31 декабря
```

Невалидные календарные компоненты отклоняются, а не переносятся автоматически:

```ts
parseDate("31.02.2026"); // null
parseDate("2026-13-01"); // null
```

`null`, `undefined`, пустая строка и строки `"null"`/`"undefined"` без учёта регистра считаются пустыми.

## Detailed parsing

### `parseDateValue(value)`

Возвращает tagged union:

```ts
type ParsedDateValue =
	{ kind: "date-time"; source: DateInputSource; date: Date } | { kind: "duration"; source: "iso-duration"; durationMs: number };
```

```ts
const parsed = parseDateValue("PT02H30M");

if (parsed?.kind === "duration") {
	parsed.durationMs; // 9_000_000
}
```

Используйте этот API, когда нужно отличить duration от календарной даты или знать распознанный источник.

### `parseDateValueTZ(value)`

Возвращает такую же структуру, но timestamp, ISO zoned и OData ticks интерпретируются как instant. Форматы без timezone всё равно остаются локальными календарными компонентами.

### `parseDate(value)` и `parseDateTZ(value)`

Возвращают только `Date | null`. Duration также превращается в `Date`, построенный из длительности относительно Unix epoch. Если продолжительность важна именно как величина, используйте `parseDateValue`, а не `Date`.

### Unix seconds и milliseconds

Число с абсолютным значением меньше `1e12` считается секундами, иначе миллисекундами:

```ts
parseDate(1_772_563_200); // seconds
parseDate(1_772_563_200_000); // milliseconds
```

Это эвристика. Не передавайте маленькое число как «год» или «дни с начала периода».

### ISO duration

Поддерживаются годы, месяцы, дни, часы, минуты, секунды и знак. Для duration:

- год приблизительно равен 365 суткам;
- месяц приблизительно равен 30 суткам;
- доли секунды ограничиваются миллисекундами;
- полностью пустое `P`/`PT` не считается duration.

Для календарных расчётов «через один месяц» используйте `addCalendarMonths`, а не duration `P1M`: календарный месяц не всегда равен 30 дням.

## Строгий парсинг по шаблону

### `parseDateByPattern(value, pattern, options?)`

Поддерживает токены:

| Токен  | Значение               |
| ------ | ---------------------- |
| `dd`   | день, ровно 2 цифры    |
| `MM`   | месяц, ровно 2 цифры   |
| `yyyy` | год, ровно 4 цифры     |
| `yy`   | год, ровно 2 цифры     |
| `HH`   | часы, ровно 2 цифры    |
| `mm`   | минуты, ровно 2 цифры  |
| `ss`   | секунды, ровно 2 цифры |

```ts
parseDateByPattern("03-03-2026 18:05", "dd-MM-yyyy HH:mm");
parseDateByPattern("03.03.26", "dd.MM.yy");
```

Двузначные годы `00–69` становятся `2000–2069`, а `70–99` — `1970–1999`.

Литералы шаблона сравниваются буквально. Токенов переменной длины (`d`, `M`, `H`) нет.

Опция `precision` может быть:

- `day` — нужны год, месяц и день;
- `month` — нужны год и месяц, день становится `1`;
- `year` — нужен год, дата становится 1 января.

Если вход не является строкой, функция делегирует обычному `parseDateValue`, а pattern не применяется.

### `parseDateByFormat(value, dateFormat?, options?)`

Принимает:

- имя зарегистрированного preset;
- style alias `short`, `medium`, `long`;
- ручной pattern;
- человекочитаемую строку, созданную Intl preset текущей locale.

```ts
parseDateByFormat("03.03.2026", "date");
parseDateByFormat("3 марта 2026 г.", "date-long");
parseDateByFormat("2026/03/03", "yyyy/MM/dd");
```

Опции:

```ts
type ParseDateByFormatOptions = {
	defaultFormat?: string;
	locale?: string;
	precision?: "day" | "month" | "year";
	referenceDate?: Date;
};
```

`referenceDate` задаёт год для presets `month-short`, `month-medium`, `month-long`, которые выводят день и месяц без года. По умолчанию используется текущий календарный год, поэтому для тестов передавайте reference явно.

## Форматирование

### `formatDate(value, presetOrName?, options?)`

```ts
function formatDate(
	value: unknown,
	presetOrName?: string | DateFormatPreset,
	options?: { fallback?: string; precision?: DateFormatPrecision }
): string;
```

По умолчанию используется preset `date` и precision `day`.

```ts
formatDate("20260303"); // "03.03.2026"
formatDate("20260303", "abap-date"); // "20260303"
formatDate("bad", "date", { fallback: "—" }); // "—"
```

Неизвестное имя preset выбрасывает `Error` до форматирования входа:

```ts
formatDate("bad", "unknown"); // Error: preset не найден
```

### Precision

```ts
formatDate(date, "date-long", { precision: "day" }); // день, месяц, год
formatDate(date, "date-long", { precision: "month" }); // месяц и год
formatDate(date, "date-long", { precision: "year" }); // год
```

Для pattern preset лишние токены даты удаляются вместе с промежуточными литералами. Time-only preset не приобретает календарные части.

## Готовые date/time wrappers

| Функция                       | Типичный результат          |
| ----------------------------- | --------------------------- |
| `formatDateAsDate`            | `03.03.2026`                |
| `formatDateAsDateTime`        | `03.03.2026 18:03`          |
| `formatDateAsTime`            | `18:03`                     |
| `formatDateAsTimeSeconds`     | `18:03:50`                  |
| `formatDateAsDateShort`       | `03.03.2026`                |
| `formatDateAsDateMedium`      | `3 мар. 2026 г.`            |
| `formatDateAsDateLong`        | `3 марта 2026 г.`           |
| `formatDateAsMonthShort`      | `03.03`                     |
| `formatDateAsMonthMedium`     | `3 мар.`                    |
| `formatDateAsMonthLong`       | `3 марта`                   |
| `formatDateAsMonthYearMedium` | `мар. 2026`                 |
| `formatDateAsMonthYearLong`   | `март 2026`                 |
| `formatDateAsTimeShort`       | `18:03`                     |
| `formatDateAsTimeMedium`      | `18:03:50`                  |
| `formatDateAsTimeLong`        | `18:03:50`                  |
| `formatDateAsDatetimeShort`   | `03.03.2026, 18:03`         |
| `formatDateAsDatetimeMedium`  | `3 мар. 2026 г., 18:03:50`  |
| `formatDateAsDatetimeLong`    | `3 марта 2026 г., 18:03:50` |

Точный punctuation и пробельные символы Intl могут слегка зависеть от JavaScript runtime/ICU. Не разбирайте человекочитаемый результат вручную, если нужен машинный контракт.

## Машинные wrappers ABAP/OData

| Функция                     | Результат             |
| --------------------------- | --------------------- |
| `formatDateAsAbapYear`      | `yyyy`                |
| `formatDateAsAbapMonth`     | `yyyyMM`              |
| `formatDateAsAbapDate`      | `yyyyMMdd`            |
| `formatDateAsAbapDatetime`  | `yyyyMMddHHmmss`      |
| `formatDateAsODataDate`     | `yyyy-MM-dd`          |
| `formatDateAsODataDatetime` | `yyyy-MM-ddTHH:mm:ss` |
| `formatDateAsODataTime`     | `PT00H00M00S`         |

```ts
formatDateAsAbapDate(new Date(2026, 2, 3)); // "20260303"
formatDateAsODataDatetime(new Date(2026, 2, 3, 18, 5, 9));
// "2026-03-03T18:05:09"
```

Эти строки собираются из локальных календарных компонентов и не добавляют timezone marker.

`formatDateAsODataTime` принимает как дату, так и ISO duration:

```ts
formatDateAsODataTime("PT02H30M05S"); // "PT02H30M05S"
```

## `formatDateRange`

Форматирует две границы одним preset и соединяет через `-`:

```ts
formatDateRange("20260301", "20260331");
// "01.03.2026 - 31.03.2026"
```

Если хотя бы одна граница не распарсилась или отформатировалась в пустой результат, возвращается общий fallback. Функция не сортирует границы. Для нормализации порядка сначала используйте `normalizeDateRange`.

## Presets

### Встроенные имена

`DEFAULT_DATE_PRESET_NAMES` содержит:

```text
date, date-short, date-medium, date-long
month-short, month-medium, month-long
month-year-medium, month-year-long
datetime, datetime-seconds
datetime-short, datetime-medium, datetime-long
time, time-seconds
time-short, time-medium, time-long
odata-date, odata-datetime
abap-datetime, abap-date, abap-month, abap-year
```

`DATE_FORMAT_STYLE_PRESET_NAMES` связывает aliases `short`, `medium`, `long` с `date-short`, `date-medium`, `date-long`.

### `getDatePreset` и `getDatePresetNames`

```ts
const preset = getDatePreset("date-long");
const names = getDatePresetNames();
```

`getDatePreset` возвращает реестровый объект, не clone. Не мутируйте его. `getDatePresetNames` возвращает новый массив в порядке регистрации.

### `registerDatePreset(config)`

```ts
registerDatePreset({
	name: "report-date",
	pattern: "dd/MM/yyyy",
	invalidFallback: "—"
});

formatDate("20260303", "report-date"); // "03/03/2026"
```

Недостающие поля берутся из `DATE_FORMAT_DEFAULTS`: locale `ru-RU`, стандартные Intl date fields и пустой invalid fallback.

Вместо pattern можно использовать:

- `intlOptions` для единого formatter-а;
- `intlDateOptions` + `intlTimeOptions` + optional `intlJoiner`;
- `durationPattern` для ISO durations.

Настройки `timeZone` и `timeZoneName` намеренно удаляются: модуль сохраняет календарную семантику и не должен скрыто сдвигать компоненты.

Регистрация глобальна. Делайте её один раз на старте до компиляции formatter pipeline. Имя и конфигурация не проходят полноценную пользовательскую валидацию.

### Объектный preset

```ts
const preset: DateFormatPreset = {
	name: "inline",
	pattern: "yyyy/MM/dd HH:mm",
	locale: "ru-RU",
	invalidFallback: "—"
};

formatDate(value, preset);
```

Объектный preset не регистрируется. Скомпилированная версия кешируется в `WeakMap` по identity объекта, поэтому переиспользуйте один стабильный объект вместо создания нового на каждую ячейку.

### `resolveDateFormatName` и `resolveDateFormatPreset`

`resolveDateFormatName` trim-ит вход, применяет default для пустого значения и преобразует style alias:

```ts
resolveDateFormatName(" medium "); // "date-medium"
```

`resolveDateFormatPreset` возвращает:

- имя, если такой preset зарегистрирован;
- кешируемый объектный pattern preset, если имя не найдено.

```ts
const presetOrName = resolveDateFormatPreset("yyyy/MM/dd");
formatDate(value, presetOrName);
```

Эта функция считает любую неизвестную непустую строку ручным pattern. Если строка не содержит поддерживаемых tokens, результат будет в основном literal-текстом.

### `resetDatePresets()`

Удаляет пользовательские presets и восстанавливает встроенные. Используйте прежде всего в тестах.

Публичной функции `clearDateFormatCache` нет. Сброс реестра выполняется только `resetDatePresets`.

### Проверки формата

```ts
isDateFormatStyle("short"); // true
isDateFormatPrecision("month"); // true
```

Это type guards для строго заданных строк.

## Pattern constants

Экспортируются:

- `DATE_PATTERN_DATE_TOKENS`;
- `DATE_PATTERN_TIME_TOKENS`;
- `DATE_PATTERN_TOKENS`;
- `DATE_PATTERN_TOKEN_RE`.

Массивы заморожены. Регулярное выражение имеет флаг `g`, поэтому при ручном вызове `test`/`exec` учитывайте изменяемый `lastIndex` или сбрасывайте его перед новым независимым проходом.

## Календарная арифметика

### Создание и границы

```ts
createCalendarDate(2026, 2, 3, 18, 5); // месяц zero-based: 2 === март
getStartOfDay(date); // 00:00:00.000
getEndOfDay(date); // 23:59:59.000
getStartOfMonth(date); // первое число, 00:00
getStartOfYear(date); // 1 января, 00:00
```

`createCalendarDate` повторяет нормализующее поведение конструктора `new Date`: например, лишний день переносится в следующий месяц. Она не является валидатором пользовательских компонентов.

Обратите внимание: `getEndOfDay` возвращает миллисекунды `000`, а не `999`. Для включительного сравнения значений с миллисекундами в последней секунде дня это может быть важно.

### Неделя

```ts
getStartOfWeek(date); // понедельник по умолчанию
getStartOfWeek(date, 0); // воскресенье
```

`weekStartsOn` использует нумерацию `Date.getDay()`: `0` — воскресенье, `1` — понедельник. Целые значения нормализуются по модулю 7, нецелое значение заменяется на `1`.

### Сдвиги

```ts
addCalendarDays(date, 1);
addCalendarMonths(date, -1);
addCalendarYears(date, 1);
```

Результаты создаются на начале суток. Используется нативное календарное переполнение JavaScript. Например, сдвиг 31 января на один месяц может перейти в март, потому что «31 февраля» нормализуется конструктором `Date`. Если нужен clamp к последнему дню целевого месяца, реализуйте это явным отдельным правилом.

### Сравнение дня

```ts
isSameCalendarDay(left, right);
```

Сравнивает только локальные year/month/day. Для не-`Date` возвращает `false`; валидность `Date#getTime()` отдельно не проверяет.

## Обычные диапазоны дат

```ts
type DateRange = readonly [Date, Date];
type NullableDateRange = readonly [Date | null, Date | null];
type DateRangeInput = Date | null | NullableDateRange;
```

### Проверки и копирование

- `isValidDate(value)` — настоящий конечный `Date`;
- `isDateRangeTuple(value)` — runtime-проверка массива;
- `cloneDate(date)` — новый `Date` с тем же timestamp;
- `orderDates(left, right)` — упорядоченная пара, но те же исходные objects.

### `resolveDateRangePair(value)`

Нормализует форму диапазона без клонирования и без изменения времени:

- одиночная дата → `[date, date]`;
- две валидные даты → упорядоченная пара;
- одна валидная граница → эта дата в обеих позициях;
- ни одной даты → `null`.

### `normalizeDateRange(value, options?)`

```ts
const range = normalizeDateRange([end, start]);
```

По умолчанию:

- упорядочивает границы;
- клонирует их;
- start приводит к началу суток;
- end приводит к концу суток.

```ts
normalizeDateRange(value, { timeMode: "preserve" });
```

`preserve` сохраняет время после упорядочивания, но всё равно возвращает новые `Date` objects.

### `requireDateRange(value, options?)`

Возвращает нормализованный диапазон либо выбрасывает `Error("Диапазон дат не задан")`.

### `countCalendarDaysInDateRange(value)`

Считает календарные дни включительно и не зависит от DST-длины локальных суток:

```ts
countCalendarDaysInDateRange([new Date(2026, 2, 1), new Date(2026, 2, 1)]); // 1
```

Для пустого диапазона возвращает `null`.

## Календарные периоды

`getCalendarPeriod(value, options?)` строит включительные границы выбранного периода:

```ts
getCalendarPeriod(date, { selectionMode: "day" });
getCalendarPeriod(date, { selectionMode: "week", weekEndDay: "saturday" });
getCalendarPeriod(date, { selectionMode: "month" });
getCalendarPeriod(date, { selectionMode: "year" });
```

По умолчанию mode — `day`, а week заканчивается в воскресенье. Неделя всегда начинается в понедельник; `weekEndDay` может быть `friday`, `saturday` или `sunday`.

`isDateInsideCalendarPeriod(value, period)` проверяет включение календарного дня. `isCalendarPeriodWithinDateBounds(period, { minDate, maxDate })` требует, чтобы весь период помещался между необязательными границами.

## Относительные диапазоны

Все resolver-ы принимают явный контекст:

```ts
const context = { referenceDate: new Date(2026, 2, 15, 12) };
```

| API                                 | Диапазон                                          |
| ----------------------------------- | ------------------------------------------------- |
| `resolveTodayRange`                 | начало и конец reference day                      |
| `resolveYesterdayRange`             | начало и конец предыдущего дня                    |
| `resolveMonthStartToTodayRange`     | с 1-го числа по сегодня                           |
| `resolveMonthStartToYesterdayRange` | с 1-го числа по вчера                             |
| `resolveMonthAgoRange`              | тот же календарный день прошлого месяца — сегодня |

На первом числе `resolveMonthStartToYesterdayRange` прижимает end к началу текущего месяца, чтобы не получить инвертированный диапазон.

`normalizeDateRangeReferenceDate` просто возвращает начало суток reference date.

Передавайте reference date явно, особенно в тестах, SSR и timezone-sensitive сценариях.

## Учебный календарь

Учебный год начинается 1 сентября и заканчивается 31 августа. Учебная неделя отображает понедельник–субботу; воскресенье относится к следующей учебной неделе.

### Ключ даты и времени

```ts
formatEducationDateKey(new Date(2026, 2, 3)); // "2026-03-03"
parseEducationDateKey("2026-03-03"); // Date
formatEducationTimeKey(new Date(2026, 2, 3, 9, 5)); // "09:05"
createEducationDateTime("2026-03-03", "09:05:30"); // Date
```

Парсер date key строгий: только `YYYY-MM-DD` и реальная дата. Time key — `HH:mm` или `HH:mm:ss`, с проверкой диапазонов.

Ключ не несёт timezone-семантики и строится из локальных календарных компонентов. Он подходит для URL, query key и SQL-параметра только если это соответствует контракту сервиса.

### Учебный год

```ts
getEducationYear(date); // год, в котором учебный год начался
getEducationYearRange(date); // { year, start, end }
isEducationDateInCurrentYear(value, now); // boolean
```

Для даты в августе 2026 функция `getEducationYear` вернёт `2025`; для сентября 2026 — `2026`.

### Учебная неделя

```ts
getEducationWeekStartDate(date); // понедельник
getEducationWeekRange(date); // понедельник–суббота
getEducationWeekDays(date); // 6 ключей YYYY-MM-DD
getCurrentEducationWeekKey(now);
normalizeEducationWeekKey(input, now);
resolveEducationWeekKey(input, now);
isCurrentEducationWeek(key, now);
```

`normalizeEducationWeekKey` возвращает `undefined`, если ключ невалиден, находится вне текущего учебного года или его понедельник вышел за границы учебного года.

`resolveEducationWeekKey` в таком случае возвращает текущую учебную неделю.

`getEducationWeekDays` имеет особый fallback: невалидная строка silently заменяется неделей текущей системной даты. Если это нежелательно, сначала вызовите `parseEducationDateKey`/`normalizeEducationWeekKey` самостоятельно.

Для детерминированных тестов всегда передавайте `now` в функции, где он поддержан.

## Практические рецепты

### UI-фильтр диапазона

```ts
const range = normalizeDateRange([draft.start, draft.end]);

if (!range) {
	return undefined;
}

const [from, to] = range;
```

### Машинный ключ без UTC-сдвига

```ts
const date = parseDate(userValue);
const key = date ? formatDateAsODataDate(date) : undefined;
```

### Настоящий timestamp события

```ts
const eventInstant = parseDateTZ(api.createdAt);
const unixMs = eventInstant?.getTime();
```

### Безопасный пользовательский preset

```ts
export function configureDateFormatters(): void {
	registerDatePreset({
		name: "document-date-time",
		pattern: "dd.MM.yyyy HH:mm:ss",
		invalidFallback: "—"
	});
}
```

## Частые ошибки

### Использовать `new Date("YYYY-MM-DD")` для календарной даты

Нативный parsing может включить UTC-семантику и сдвинуть видимый день. Используйте `parseDate` или `parseEducationDateKey` в зависимости от контракта.

### Ожидать timezone conversion от обычного formatter-а

`formatDate` использует floating parsing. Для instant сначала разберите `parseDateTZ`, а дальнейшее локальное/UTC отображение проектируйте явно.

### Считать `getEndOfDay` концом с `.999`

Текущий контракт — `23:59:59.000`.

### Ожидать clamp от `addCalendarMonths`

Функция использует native overflow. Последний день месяца требует отдельного правила.

### Использовать human-readable output как API payload

Intl-форматы локализованы. Для API используйте ABAP/OData wrappers или отдельный transport serializer.

### Регистрировать preset при каждом рендере

Реестр глобальный, а компиляция должна выполняться один раз. Настраивайте presets на bootstrap-stage.

## API-справка

| Семейство        | Публичный API                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parsing          | `parseDateValue`, `parseDateValueTZ`, `parseDate`, `parseDateTZ`, `parseDateByPattern`, `parseDateByFormat`                                                                                                                                                                                                                                                                       |
| Universal format | `formatDate`, `formatDateRange`                                                                                                                                                                                                                                                                                                                                                   |
| UI wrappers      | все `formatDateAsDate*`, `formatDateAsMonth*`, `formatDateAsTime*`, `formatDateAsDatetime*`                                                                                                                                                                                                                                                                                       |
| Machine wrappers | `formatDateAsAbapYear`, `formatDateAsAbapMonth`, `formatDateAsAbapDate`, `formatDateAsAbapDatetime`, `formatDateAsODataDate`, `formatDateAsODataDatetime`, `formatDateAsODataTime`                                                                                                                                                                                                |
| Presets          | `DATE_FORMAT_DEFAULTS`, `DEFAULT_DATE_PRESET_NAMES`, `DATE_FORMAT_STYLE_PRESET_NAMES`, `getDatePreset`, `getDatePresetNames`, `registerDatePreset`, `resetDatePresets`, `resolveDateFormatName`, `resolveDateFormatPreset`, type guards                                                                                                                                           |
| Calendar         | `createCalendarDate`, `getStartOfDay`, `getEndOfDay`, `getStartOfWeek`, `getStartOfMonth`, `getStartOfYear`, `addCalendarDays`, `addCalendarMonths`, `addCalendarYears`, `isSameCalendarDay`                                                                                                                                                                                      |
| Ranges           | `isValidDate`, `isDateRangeTuple`, `cloneDate`, `orderDates`, `resolveDateRangePair`, `normalizeDateRange`, `requireDateRange`, `countCalendarDaysInDateRange`                                                                                                                                                                                                                    |
| Periods          | `getCalendarPeriod`, `isDateInsideCalendarPeriod`, `isCalendarPeriodWithinDateBounds`                                                                                                                                                                                                                                                                                             |
| Relative ranges  | `normalizeDateRangeReferenceDate`, `resolveTodayRange`, `resolveYesterdayRange`, `resolveMonthStartToTodayRange`, `resolveMonthStartToYesterdayRange`, `resolveMonthAgoRange`                                                                                                                                                                                                     |
| Education        | `parseEducationDateKey`, `formatEducationDateKey`, `formatEducationTimeKey`, `createEducationDateTime`, `getEducationYear`, `getEducationYearRange`, `isEducationDateInCurrentYear`, `getEducationWeekStartDate`, `getEducationWeekRange`, `getEducationWeekDays`, `getCurrentEducationWeekKey`, `normalizeEducationWeekKey`, `resolveEducationWeekKey`, `isCurrentEducationWeek` |
| Pattern metadata | `DATE_PATTERN_DATE_TOKENS`, `DATE_PATTERN_TIME_TOKENS`, `DATE_PATTERN_TOKENS`, `DATE_PATTERN_TOKEN_RE`                                                                                                                                                                                                                                                                            |

Соответствующие types (`DateFormatPreset`, `FormatDateOptions`, range/period/education types и parse options) экспортируются из того же `/formatters` entrypoint.

### Каталог публичных типов

| Область           | Типы                                                                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parsing и format  | `DateInputSource`, `ParsedDateValue`, `DateFormatPattern`, `DateFormatStyle`, `DateFormatPrecision`, `DateFormatPreset`, `DateFormatPresetConfig`, `FormatDateOptions`, `ParseDateByPatternOptions`, `ParseDateByFormatOptions`, `ResolveDateFormatPresetOptions` |
| Диапазоны         | `NullableDateRange`, `DateRange`, `DateRangeInput`, `DateRangeTimeMode`, `NormalizeDateRangeOptions`, `DateRangeReferenceContext`                                                                                                                                 |
| Периоды           | `CalendarPeriod`, `CalendarPeriodOptions`, `CalendarPeriodSelectionMode`, `CalendarWeekEndDay`, `CalendarPeriodDateBounds`                                                                                                                                        |
| Учебный календарь | `EducationDateKey`, `EducationYearRange`, `EducationWeekRange`                                                                                                                                                                                                    |

Импортируйте их с модификатором `type`, чтобы подчеркнуть отсутствие runtime-значения:

```ts
import type { DateFormatPresetConfig, DateRange, NormalizeDateRangeOptions } from "@ryuzaki13/react-foundation-lib/formatters";
```

## Связанная документация

- [Обзор `formatters`](../README.md)
- [Formatter pipeline](../pipeline/README.md)
- [Числовые форматтеры](../number/README.md)
