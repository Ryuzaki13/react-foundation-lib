# Идентификаторы и строковые hash через `@ryuzaki13/react-foundation-lib/crypto`

Модуль `crypto` предоставляет небольшие функции для двух разных задач:

- получить детерминированный компактный hash из строки;
- создать случайный UUID версии 4.

Детерминированный результат всегда повторяется для той же строки. Случайный UUID, наоборот, создаётся заново при каждом вызове. Это принципиально разные виды идентификаторов, и выбирать между ними нужно по смыслу задачи.

Несмотря на имя entrypoint, строковые hash этого модуля не являются криптографическими. Они не подходят для паролей, подписей, access token, проверки безопасности или сокрытия персональных данных.

README рассчитан на разработчика, который использует опубликованный пакет без доступа к исходному коду. Здесь объясняются базовые понятия, точные форматы результатов, browser runtime, Unicode, коллизии, React/SSR, тестирование и безопасные границы применения.

## Содержание

- [Назначение и границы модуля](#назначение-и-границы-модуля)
- [Установка и импорт](#установка-и-импорт)
- [Минимальные понятия](#минимальные-понятия)
- [Как выбрать API](#как-выбрать-api)
- [Быстрый старт](#быстрый-старт)
- [Общие правила строковых hash](#общие-правила-строковых-hash)
- [`hashString`](#hashstring)
- [`hashString128`](#hashstring128)
- [`hashString128Base64Url`](#hashstring128base64url)
- [`stringToElementId`](#stringtoelementid)
- [`uuidv4`](#uuidv4)
- [Подготовка сложных данных](#подготовка-сложных-данных)
- [Безопасность](#безопасность)
- [Коллизии и обрезание результата](#коллизии-и-обрезание-результата)
- [Browser, Node.js и SSR](#browser-nodejs-и-ssr)
- [React-рецепты](#react-рецепты)
- [Тестирование](#тестирование)
- [Производительность](#производительность)
- [Ограничения и частые ошибки](#ограничения-и-частые-ошибки)
- [Краткий справочник API](#краткий-справочник-api)
- [Вопросы и ответы](#вопросы-и-ответы)

## Назначение и границы модуля

### Что делает `crypto`

- строит короткий 32-bit hash в base36;
- строит более длинный строковый hash в 32-символьном hexadecimal формате;
- кодирует тот же длинный hash в компактный URL-safe base64 без padding;
- добавляет префикс к длинному hash для получения DOM-like ID;
- создаёт UUID v4 через Web Crypto;
- использует native `crypto.randomUUID`, если он доступен;
- имеет fallback UUID через `crypto.getRandomValues`.

### Чего модуль не делает

- не шифрует и не расшифровывает данные;
- не вычисляет SHA-256, SHA-512, HMAC или цифровую подпись;
- не хеширует пароли безопасным password hashing алгоритмом;
- не гарантирует отсутствие коллизий;
- не проверяет уникальность результата по базе данных;
- не нормализует регистр, пробелы, Unicode или JSON;
- не сериализует объект автоматически;
- не хранит созданные UUID;
- не создаёт React hydration-safe ID вместо `useId`;
- не превращает UUID в право доступа или security token.

### Две группы API

| Группа                  | Функции                                                                      | Свойство                                                |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Детерминированные hash  | `hashString`, `hashString128`, `hashString128Base64Url`, `stringToElementId` | Та же точная строка даёт тот же результат.              |
| Случайный идентификатор | `uuidv4`                                                                     | Каждый вызов должен создавать новое случайное значение. |

## Установка и импорт

Установите пакет:

```bash
npm install @ryuzaki13/react-foundation-lib
```

Импортируйте функции только из опубликованного subpath `/crypto`:

```ts
import { hashString, hashString128, hashString128Base64Url, stringToElementId, uuidv4 } from "@ryuzaki13/react-foundation-lib/crypto";
```

Корневой импорт пакета не поддерживается:

```ts
// Неправильно.
import { uuidv4 } from "@ryuzaki13/react-foundation-lib";

// Правильно.
import { uuidv4 } from "@ryuzaki13/react-foundation-lib/crypto";
```

Entrypoint `/crypto` не импортирует React и не содержит hooks.

Модуль поставляется как ESM. Часть API использует browser globals:

| API                      | Требуемые возможности runtime                             |
| ------------------------ | --------------------------------------------------------- |
| `hashString`             | Обычные `String`, `Number` и bitwise operations           |
| `hashString128`          | Дополнительно `Math.imul`                                 |
| `hashString128Base64Url` | Дополнительно глобальный `btoa`                           |
| `stringToElementId`      | Глобальный `btoa`, потому что вызывает предыдущую функцию |
| `uuidv4`                 | Глобальный Web Crypto `crypto`                            |

Наличие одноимённых API в конкретной версии Node.js не является частью browser-oriented контракта пакета. Проверяйте среду, если вызываете эти функции вне браузера.

## Минимальные понятия

### Идентификатор

Идентификатор — строка, по которой приложение отличает одну сущность от другой:

```ts
const userId = "user-42";
```

Хороший идентификатор должен соответствовать задаче. Иногда он должен повторяться для одинакового входа, а иногда должен быть новым для каждой созданной сущности.

### Детерминированность

Детерминированная функция всегда возвращает одинаковый результат для одинакового входа:

```ts
hashString128("user:42") === hashString128("user:42"); // true
```

Это удобно для:

- cache-like ключей;
- стабильных DOM ID по известному business key;
- fingerprint нормализованной конфигурации;
- группировки или быстрого предварительного сравнения.

### Случайность

`uuidv4()` использует криптографически стойкий генератор случайных байтов среды:

```ts
const first = uuidv4();
const second = uuidv4();

console.log(first === second); // Практически ожидается false.
```

Случайный UUID удобен, когда новая сущность должна получить новый ID независимо от её содержимого.

### Hash

Hash-функция превращает вход произвольной длины в результат ограниченной длины:

```text
"user:42" → "fa3326027b653e8049d56072c88378f0"
```

Поскольку возможных входных строк бесконечно много, а возможных результатов конечное количество, две разные строки теоретически могут получить одинаковый hash. Это называется коллизией.

### Hash не является шифрованием

Шифрование предполагает возможность расшифровать данные при наличии ключа. Эти hash-функции не имеют операции обратного восстановления.

Но отсутствие обратной функции не делает их безопасным способом скрыть данные. Короткий или предсказуемый вход можно подобрать перебором:

```ts
hashString128("user@example.com"); // Это не безопасная анонимизация email.
```

### Base36

Base36 использует цифры `0-9` и латинские буквы `a-z`. Например, десятичное число можно записать короче за счёт 36 возможных символов.

`hashString` возвращает именно такой формат:

```text
d5nw5e
```

### Hexadecimal

Hexadecimal, или base16, использует:

```text
0123456789abcdef
```

`hashString128` всегда возвращает 32 lowercase hex-символа.

### Base64 URL-safe

Обычный base64 может содержать `+`, `/` и padding `=`. URL-safe вариант заменяет проблемные символы:

- `+` → `-`;
- `/` → `_`;
- завершающие `=` удаляются.

`hashString128Base64Url` возвращает 22 символа из набора:

```text
A-Z a-z 0-9 - _
```

### UUID v4

UUID v4 — случайный идентификатор стандартного формата:

```text
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

- общая длина — 36 символов;
- дефисы находятся в фиксированных позициях;
- `4` обозначает версию 4;
- первый символ группы `y` соответствует UUID variant.

Пример:

```text
550e8400-e29b-41d4-a716-446655440000
```

## Как выбрать API

| Задача                                                         | API                                 |
| -------------------------------------------------------------- | ----------------------------------- |
| Нужен очень короткий non-security hash                         | `hashString`                        |
| Нужен стабильный длинный hash для сравнения/config fingerprint | `hashString128`                     |
| Нужен компактный URL-safe вариант длинного hash                | `hashString128Base64Url`            |
| Нужен стабильный DOM-like ID по строке                         | `stringToElementId`                 |
| Нужен новый случайный ID для создаваемой сущности              | `uuidv4`                            |
| Нужна связь label/input внутри React-компонента с SSR          | React `useId`, не этот модуль       |
| Нужен password hash                                            | Специализированный password hasher  |
| Нужна криптографическая целостность или подпись                | Web Crypto/серверная crypto-система |
| Нужен уникальный business ID с централизованной проверкой      | Backend/database contract           |

## Быстрый старт

### Стабильный hash

```ts
import { hashString128 } from "@ryuzaki13/react-foundation-lib/crypto";

const fingerprint = hashString128("customer:42");

console.log(fingerprint); // Одна и та же строка всегда даст тот же результат.
```

### Стабильный ID DOM-элемента

```ts
import { stringToElementId } from "@ryuzaki13/react-foundation-lib/crypto";

const rowId = stringToElementId("customer:42");
const cellId = stringToElementId("customer:42:name", "cell");
```

Примерный формат:

```text
row-<22 URL-safe символа>
cell-<22 URL-safe символа>
```

### Новый UUID

```ts
import { uuidv4 } from "@ryuzaki13/react-foundation-lib/crypto";

const draft = {
	id: uuidv4(),
	title: "Новая запись"
};
```

## Общие правила строковых hash

### Вход всегда строка

Все hash-функции принимают `string`:

```ts
hashString128("42"); // Корректно.
hashString128(42); // Ошибка TypeScript.
```

Число `42` и строка `"42"` — разные типы. Если вы осознанно преобразуете значение, делайте это явно:

```ts
hashString128(String(42));
```

### Обрабатывается точная последовательность UTF-16 code units

JavaScript хранит строки как последовательности UTF-16 code units. Реализация проходит строку через `charCodeAt`.

Поэтому имеют значение:

- регистр букв;
- пробелы и переводы строк;
- порядок символов;
- composed/decomposed форма Unicode;
- каждый code unit surrogate pair.

```ts
hashString128("User") !== hashString128("user");
hashString128("A") !== hashString128(" A ");
```

### Unicode не нормализуется

Визуально одинаковые строки могут иметь разное внутреннее представление:

```ts
const composed = "Café";
const decomposed = "Cafe\u0301";

console.log(composed === decomposed); // false
console.log(hashString128(composed) === hashString128(decomposed)); // false
```

Если доменная модель считает их одинаковыми, нормализуйте строку на явно выбранной boundary:

```ts
const canonical = input.normalize("NFC");
const hash = hashString128(canonical);
```

Если буквальная форма важна, не нормализуйте её.

### Пустая строка допустима

Функции не отклоняют пустой вход:

```ts
hashString("");
hashString128("");
hashString128Base64Url("");
```

Пустая строка имеет свой стабильный hash. Проверять обязательность входа должен вызывающий код.

### Разные hash не означают разную силу защиты

`hashString128` и `hashString128Base64Url` кодируют один и тот же внутренний результат разными способами. Base64Url-версия короче, но не безопаснее и не слабее hex-версии с точки зрения коллизий.

## `hashString`

Возвращает компактный FNV-1a-like 32-bit hash в base36.

### Сигнатура

```ts
declare function hashString(input: string): string;
```

### Формат результата

- только символы `0-9` и `a-z`;
- lowercase;
- переменная длина от 1 до 7 символов;
- результат соответствует unsigned 32-bit значению, записанному в base36.

### Примеры текущей реализации

```ts
hashString(""); // "ztntfp"
hashString("user:42"); // "d5nw5e"
hashString("строка"); // "hb03a2"
```

### Когда использовать

- компактный ключ небольшой UI-коллекции;
- некритичный short fingerprint;
- bucket/group key, где коллизия дополнительно обрабатывается;
- диагностическая метка, не являющаяся источником истины.

### Когда не использовать

- primary key;
- проверка уникальности большого набора;
- security decision;
- контроль целостности данных;
- password/token/signature;
- ситуация, где коллизия приводит к потере или перезаписи данных.

32-bit пространство сравнительно мало. Не делайте вывод, что разные входы обязательно имеют разные результаты.

## `hashString128`

Возвращает длинный non-cryptographic hash в hexadecimal формате.

### Сигнатура

```ts
declare function hashString128(input: string): string;
```

### Формат результата

- ровно 32 символа;
- только `0-9` и `a-f`;
- lowercase;
- четыре внутренних unsigned 32-bit слова записываются по 8 hex-символов.

```ts
const result = hashString128("user:42");

console.log(result); // "fa3326027b653e8049d56072c88378f0"
console.log(result.length); // 32
```

### Когда использовать

- fingerprint канонической строки конфигурации;
- стабильный cache-like key;
- сравнение версий данных с допустимым non-adversarial collision risk;
- стабильная техническая метка, для которой 32-bit hash слишком короток.

### Важное ограничение

Название `128` описывает формат из 128 output bits, а не криптографическую стойкость. Внутри используется собственное быстрое смешивание четырёх 32-bit состояний. Не приравнивайте функцию к MD5, SHA-256 или другому cryptographic digest.

## `hashString128Base64Url`

Возвращает тот же длинный внутренний hash в более компактной URL-safe форме.

### Сигнатура

```ts
declare function hashString128Base64Url(input: string): string;
```

### Формат результата

- ровно 22 символа;
- символы `A-Z`, `a-z`, `0-9`, `-`, `_`;
- без `+`, `/` и padding `=`;
- регистр имеет значение.

```ts
const result = hashString128Base64Url("user:42");

console.log(result); // "-jMmAntlPoBJ1WByyIN48A"
console.log(result.length); // 22
```

Результат может начинаться с `-` или `_`. Это допустимая часть Base64Url-алфавита.

### Когда использовать

- segment технического URL;
- компактный ключ для browser storage;
- DOM-like ID вместе с безопасным префиксом;
- data attribute;
- короткое представление того же результата, который можно было записать через `hashString128`.

### Runtime

Функция преобразует 16 байтов через глобальный `btoa`. В среде без `btoa` будет выброшена ошибка. Функция не содержит fallback и не перехватывает её.

### Это не кодирование исходной строки

Base64Url здесь кодирует байты hash, а не исходный `input`. Декодирование результата вернёт 16 байтов hash и не восстановит исходную строку.

## `stringToElementId`

Добавляет префикс к результату `hashString128Base64Url`.

### Сигнатура

```ts
declare function stringToElementId(input: string, prefix?: string): string;
```

### Параметры

| Параметр | Тип      | По умолчанию | Назначение                                |
| -------- | -------- | ------------ | ----------------------------------------- |
| `input`  | `string` | —            | Строка, определяющая стабильную часть ID. |
| `prefix` | `string` | `"row"`      | Читаемая часть перед hash.                |

### Формула результата

```ts
`${prefix}-${hashString128Base64Url(input)}`;
```

### Примеры текущей реализации

```ts
stringToElementId("user:42");
// "row--jMmAntlPoBJ1WByyIN48A"

stringToElementId("user:42", "cell");
// "cell--jMmAntlPoBJ1WByyIN48A"
```

Двойной дефис в примере корректен: первый добавлен между prefix и hash, второй является первым символом Base64Url hash.

### Стабильность

Одинаковые `input` и `prefix` дают одинаковый результат:

```ts
stringToElementId("row:42", "cell") === stringToElementId("row:42", "cell"); // true
```

Разные префиксы разводят namespaces:

```ts
stringToElementId("42", "row");
stringToElementId("42", "cell");
```

### Prefix не очищается

Функция вставляет `prefix` буквально. Она не удаляет пробелы и не экранирует CSS:

```ts
stringToElementId("42", "my row"); // Содержит пробел в ID.
stringToElementId("42", ""); // Начинается с дефиса.
```

Используйте короткий контролируемый prefix из букв, цифр, `_` или `-`. Не передавайте произвольный пользовательский ввод как prefix.

### Поиск элемента

При default или безопасном prefix можно использовать:

```ts
const id = stringToElementId("row:42");
const element = document.getElementById(id);
```

Если ID участвует в CSS selector и его состав не полностью контролируется, экранируйте значение:

```ts
const element = document.querySelector(`#${CSS.escape(id)}`);
```

### Когда выбрать React `useId`

Для связи `label`, `input`, `aria-describedby` и других элементов внутри React-компонента обычно лучше `useId`:

```tsx
const id = useId();

return (
	<>
		<label htmlFor={id}>Имя</label>
		<input id={id} />
	</>
);
```

`useId` согласован с React SSR и hydration. `stringToElementId` нужен, когда ID должен определяться внешним стабильным business/technical key, одинаковым в разных местах.

### Коллизия всё ещё возможна

Добавление prefix не делает hash уникальным. Если два input получили одинаковый hash и prefix совпадает, ID тоже совпадёт.

## `uuidv4`

Создаёт случайный UUID версии 4 через глобальный Web Crypto API.

### Сигнатура

```ts
declare function uuidv4(): string;
```

### Алгоритм выбора

1. Если `crypto.randomUUID` доступен, функция сразу возвращает его результат.
2. Иначе создаёт `Uint8Array(16)`.
3. Заполняет его через `crypto.getRandomValues`.
4. Устанавливает version bits для UUID v4.
5. Устанавливает variant bits.
6. Форматирует байты как lowercase строку `8-4-4-4-12`.

```text
xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
```

### Пример создания сущности

```ts
type Draft = {
	id: string;
	title: string;
};

export function createDraft(title: string): Draft {
	return {
		id: uuidv4(),
		title
	};
}
```

### Функция не проверяет результат native API

Если существует `crypto.randomUUID`, его результат возвращается как есть. Дополнительная проверка UUID-формата не выполняется. В обычном браузере Web Crypto соблюдает контракт; в тестовом mock ответственность лежит на тесте.

### Ошибки не перехватываются

Если глобальный `crypto` отсутствует либо недоступны и `randomUUID`, и `getRandomValues`, функция выбросит runtime error. Она не имеет Math.random fallback и не возвращает `null`.

Это правильная граница: слабая псевдослучайность не подменяет Web Crypto незаметно.

### UUID не гарантируется базой данных

Вероятность случайного совпадения очень мала, но математическая гарантия отсутствует. Для authoritative storage всё равно используйте unique constraint и корректно обрабатывайте конфликт.

### Не обрезайте UUID без оценки риска

```ts
uuidv4().slice(0, 8);
```

Такой результат содержит только небольшую часть UUID и резко уменьшает пространство вариантов. Это может быть приемлемо для временной UI-метки, но не для долговечного уникального ключа.

### UUID не является автоматически security token

UUID v4 создаётся из криптографической случайности, но его назначение — идентификация. Требования к session token, reset link или access credential включают не только случайность, но также хранение, срок жизни, отзыв, transport и threat model. Используйте контракт системы безопасности, а не предположение «UUID выглядит случайным».

## Подготовка сложных данных

### Объект нельзя передать напрямую

```ts
const config = { page: 1, sort: "name" };

hashString128(config); // Ошибка TypeScript: ожидается string.
```

Сначала нужен детерминированный serializer.

### Почему обычный `JSON.stringify` может быть недостаточен

Порядок object keys может различаться:

```ts
const first = { page: 1, sort: "name" };
const second = { sort: "name", page: 1 };

JSON.stringify(first) !== JSON.stringify(second);
```

Если модель считает эти объекты одинаковыми, используйте каноническое представление. В foundation-пакете для JSON-like технических значений есть `stableStringify`:

```ts
import { hashString128 } from "@ryuzaki13/react-foundation-lib/crypto";
import { stableStringify } from "@ryuzaki13/react-foundation-lib/utils";

const fingerprint = hashString128(stableStringify(config));
```

Перед использованием определите доменные правила:

- важен ли порядок массивов;
- нужно ли сохранять внешний whitespace;
- одинаковы ли uppercase/lowercase;
- как представляются даты;
- допустимы ли `undefined`, функции или циклические ссылки;
- на какой boundary выполняется нормализация.

Hash не исправляет неоднозначную сериализацию. Он только детерминированно обрабатывает полученную строку.

### Составной строковый ключ

Простое объединение может быть неоднозначным:

```ts
`${first}:${second}`;
```

Если значения сами содержат `:`, разные пары способны сформировать одинаковую строку. Используйте однозначную serialization scheme:

```ts
const canonical = stableStringify([first, second]);
const key = hashString128Base64Url(canonical);
```

## Безопасность

### Матрица допустимости

| Задача                                        | Подходит ли модуль    | Почему                                                     |
| --------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| UI/cache fingerprint некритичных данных       | Да                    | Быстро и детерминированно.                                 |
| Stable DOM-like ID                            | Да, с учётом коллизий | Есть компактный URL-safe формат и prefix.                  |
| Случайный ID новой сущности                   | Да                    | `uuidv4` использует Web Crypto.                            |
| Проверка пароля                               | Нет                   | Нужен slow password hashing с salt и политикой параметров. |
| Подпись запроса                               | Нет                   | Нужен keyed cryptographic MAC/signature.                   |
| Проверка загруженного файла по trusted digest | Нет                   | Нужен cryptographic digest и доверенный expected value.    |
| Сокрытие email/телефона                       | Нет                   | Предсказуемый вход можно подобрать перебором.              |
| Access token                                  | Не автоматически      | UUID не заменяет полный security contract.                 |
| Уникальность записи в базе                    | Недостаточно          | Нужен unique constraint/authoritative allocation.          |

### Не принимайте security decision по этим hash

Нельзя предоставлять доступ, считать payload доверенным или пропускать validation только потому, что hash совпал. Non-cryptographic hash не защищён от намеренно подобранных коллизий.

### Не храните hash как доказательство исходного секрета

```ts
hashString128(password);
```

Так хранить пароль нельзя. Функция быстрая, не использует salt и специально не предназначена для сопротивления перебору.

### Не путайте Base64Url с безопасностью

Base64Url — только формат записи байтов. Он не шифрует и не подписывает значение.

## Коллизии и обрезание результата

### Что гарантирует детерминированность

- одинаковая точная строка даёт одинаковый hash;
- если два hash различаются, исходные строки точно различались;
- если два hash совпали, исходные строки могли быть одинаковыми или попасть в коллизию.

Последний пункт особенно важен: совпадение hash не доказывает равенство исходных данных.

### Сохраняйте исходный ключ, если ошибка недопустима

Для map/cache можно хранить bucket по hash, а внутри дополнительно сравнивать каноническую строку:

```ts
type Entry<T> = {
	canonical: string;
	value: T;
};
```

Так коллизия hash не смешает разные данные.

### Не обрезайте длинный hash без причины

```ts
hashString128Base64Url(input).slice(0, 8);
```

Обрезание уменьшает число возможных результатов и повышает вероятность коллизии. Если короткая форма обязательна, оцените размер набора, последствия совпадения и наличие secondary equality check.

### Hex и Base64Url имеют одинаковую collision policy

32 hex-символа и 22 Base64Url-символа представляют один внутренний результат. Выбирайте по требованиям к формату, а не по предполагаемой «надёжности».

### Версионируйте долговечный fingerprint

Если результат сохраняется в БД, URL или файле на годы, алгоритм становится частью формата данных. Добавьте версию схемы:

```ts
const fingerprint = `v1:${hashString128(canonical)}`;
```

Тогда будущая замена алгоритма сможет использовать `v2:` и явную миграцию. Не предполагайте, что внутренний алгоритм любой utility-функции никогда не изменится между major versions.

## Browser, Node.js и SSR

### Чистые строковые варианты

`hashString` и `hashString128` используют стандартные операции JavaScript и не обращаются к DOM или Web Crypto.

### `btoa` boundary

`hashString128Base64Url` и `stringToElementId` используют глобальный `btoa`. В browser он обычно доступен. В server/test runtime его наличие нужно проверить или предоставить совместимый polyfill на уровне среды.

Не добавляйте случайный локальный encoder с другим byte order: server и client должны выдавать одинаковый результат.

### Web Crypto boundary

`uuidv4` обращается к глобальному `crypto`. В runtime без Web Crypto функция завершится ошибкой.

### Hydration

Не вызывайте `uuidv4()` прямо во время server и client render одного и того же компонента:

```tsx
// Неправильно для SSR и нестабильно при повторных рендерах.
const id = uuidv4();
```

Server и client создадут разные строки, а каждый render создаст новый UUID.

Для DOM/ARIA ID используйте `useId`. Для ID новой domain entity вызывайте `uuidv4` в момент пользовательской команды или на authoritative creation boundary.

Детерминированный `stringToElementId` может совпасть на server и client только если:

- обе стороны получили совершенно одинаковый input и prefix;
- обе стороны используют ту же версию алгоритма;
- обе среды поддерживают нужный `btoa` contract.

## React-рецепты

### Новый ID при добавлении элемента

```tsx
function DraftList() {
	const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);

	const addItem = () => {
		setItems((current) => [
			...current,
			{
				id: uuidv4(),
				title: "Новый элемент"
			}
		]);
	};

	return (
		<button type="button" onClick={addItem}>
			Добавить
		</button>
	);
}
```

UUID создаётся только при команде добавления, а не при каждом render.

### Client-only ID, сохранённый в state

```tsx
function ClientOnlyDraft() {
	const [id] = useState(() => uuidv4());

	return <span>{id}</span>;
}
```

Такой вариант сохраняет ID между client renders, но не решает SSR hydration. В development Strict Mode initializer может быть вызван повторно для проверки чистоты; использовать UUID как side effect вне state нельзя.

### Стабильный row ID по business key

```tsx
function CustomerRow({ customerId }: { customerId: string }) {
	const rowId = stringToElementId(customerId, "customer-row");

	return <tr id={rowId}>{/* Ячейки строки. */}</tr>;
}
```

Если `customerId` изменится, изменится и DOM ID. Если две строки имеют одинаковый customer ID, они получат одинаковый DOM ID.

## Тестирование

### Проверяйте детерминированность и формат

```ts
import { describe, expect, it } from "vitest";
import { hashString128, hashString128Base64Url } from "@ryuzaki13/react-foundation-lib/crypto";

describe("fingerprint", () => {
	it("стабилен для одинакового входа", () => {
		expect(hashString128("row:42")).toBe(hashString128("row:42"));
	});

	it("имеет ожидаемый формат", () => {
		expect(hashString128("row:42")).toMatch(/^[0-9a-f]{32}$/);
		expect(hashString128Base64Url("row:42")).toMatch(/^[0-9A-Za-z_-]{22}$/);
	});
});
```

Тест `hash(a) !== hash(b)` для одной выбранной пары не доказывает отсутствие коллизий вообще.

### Test vectors текущей реализации

| Input       | `hashString` | `hashString128`                    | `hashString128Base64Url` |
| ----------- | ------------ | ---------------------------------- | ------------------------ |
| `""`        | `ztntfp`     | `c431d55b3afb3e003e41d50fc08b3e54` | `xDHVWzr7PgA-QdUPwIs-VA` |
| `"user:42"` | `d5nw5e`     | `fa3326027b653e8049d56072c88378f0` | `-jMmAntlPoBJ1WByyIN48A` |
| `"строка"`  | `hb03a2`     | `86aac3ec19e5093dc3b2f1985cfd3b49` | `hqrD7BnlCT3DsvGYXP07SQ` |

Exact vectors полезны, если hash является частью сериализуемого формата. Если формат не долговечный, часто достаточно проверять детерминированность и regex.

### Mock native `randomUUID`

```ts
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
});

it("использует native randomUUID", () => {
	const randomUUID = vi.fn(() => "00000000-0000-4000-8000-000000000000");
	vi.stubGlobal("crypto", { randomUUID } as unknown as Crypto);

	expect(uuidv4()).toBe("00000000-0000-4000-8000-000000000000");
	expect(randomUUID).toHaveBeenCalledOnce();
});
```

### Mock fallback `getRandomValues`

```ts
it("устанавливает version и variant bits", () => {
	const getRandomValues = vi.fn((bytes: Uint8Array) => {
		bytes.set([0, 1, 2, 3, 4, 5, 0xff, 7, 0xff, 9, 10, 11, 12, 13, 14, 15]);
		return bytes;
	});

	vi.stubGlobal("crypto", { getRandomValues } as unknown as Crypto);

	expect(uuidv4()).toBe("00010203-0405-4f07-bf09-0a0b0c0d0e0f");
});
```

Всегда восстанавливайте global mocks после теста, иначе они повлияют на другие test cases.

### Проверка реального UUID без mock

Если среда предоставляет Web Crypto:

```ts
expect(uuidv4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
```

Не фиксируйте конкретное случайное значение без mock.

## Производительность

### Сложность hash

Каждая hash-функция проходит строку один раз. Временная сложность — `O(n)`, где `n` является числом UTF-16 code units.

Алгоритмы работают быстро и синхронно. Но длинная строка всё равно блокирует текущий JavaScript thread на время обработки.

### Не хешируйте одно и то же на каждом render без необходимости

Для большого canonical payload можно вычислять fingerprint на boundary изменения или мемоизировать по стабильной ссылке:

```tsx
const fingerprint = useMemo(() => hashString128(stableStringify(config)), [config]);
```

`useMemo` помогает только если зависимость `config` действительно стабильна между неизменившимися renders.

### UUID и hex table

Fallback `uuidv4` создаёт таблицу из 256 hex-строк при каждом вызове. Для обычного создания ID это несущественно. Не используйте функцию как tight-loop генератор миллионов значений на UI thread без измерений.

## Ограничения и частые ошибки

### Использование `hashString` как уникального primary key

32-bit hash слишком мал для такого обещания. Используйте UUID/backend ID или храните исходный ключ и обрабатывайте коллизии.

### Hash пароля или токена

```ts
const storedPassword = hashString128(password); // Небезопасно.
```

Эта функция быстрая, несолёная и non-cryptographic.

### Нестабильная сериализация объекта

Если порядок ключей или нормализация входа плавают, hash тоже будет меняться. Сначала создайте canonical string.

### Ожидание одинакового hash для визуально одинакового Unicode

Unicode normalization не выполняется. Выберите NFC/NFD policy явно, если это требуется доменом.

### Обрезание UUID или hash

Обрезание уменьшает пространство результатов. Нельзя сохранять прежние гарантии после `.slice(...)`.

### `uuidv4()` внутри render

Новый UUID будет создаваться при каждом render и может нарушить SSR hydration. Создавайте entity ID на command boundary; для DOM relationships используйте `useId`.

### Небезопасный prefix

`stringToElementId` не очищает prefix. Пробелы, кавычки или CSS-special characters останутся в строке.

### Ожидание server portability

`btoa` и global Web Crypto могут отсутствовать в server/test runtime. Тестируйте целевую среду и не подменяйте алгоритм несовместимой реализацией.

### Сравнение только по hash

Совпавший hash не доказывает полное равенство. Для критичных данных сравнивайте исходную canonical string или содержимое.

## Краткий справочник API

| API                      | Вход                       | Результат                 | Детерминированность | Runtime                  | Security                      |
| ------------------------ | -------------------------- | ------------------------- | ------------------- | ------------------------ | ----------------------------- |
| `hashString`             | `string`                   | 1–7 base36 символов       | Да                  | Обычный JS               | Non-cryptographic, 32-bit     |
| `hashString128`          | `string`                   | 32 lowercase hex-символа  | Да                  | Обычный JS + `Math.imul` | Non-cryptographic             |
| `hashString128Base64Url` | `string`                   | 22 URL-safe символа       | Да                  | Дополнительно `btoa`     | Тот же hash, другой формат    |
| `stringToElementId`      | `input`, optional `prefix` | `${prefix}-${22 symbols}` | Да                  | Дополнительно `btoa`     | Коллизия возможна             |
| `uuidv4`                 | Нет                        | UUID v4 string            | Нет                 | Global Web Crypto        | Random ID, не security system |

## Вопросы и ответы

### Какую hash-функцию выбрать по умолчанию?

Для некритичного устойчивого fingerprint обычно выбирайте `hashString128`. Если важна компактность и URL-safe формат — `hashString128Base64Url`. `hashString` оставляйте для сценариев, где 32-bit коллизии безопасно обрабатываются.

### Почему Base64Url-результат короче hex?

Hex кодирует 4 bits одним символом, а Base64 — 6 bits. Поэтому те же 16 байтов помещаются в 22 Base64Url-символа вместо 32 hex-символов.

### Можно ли восстановить исходную строку из hash?

Прямой операции восстановления нет. Но короткие и предсказуемые значения можно подобрать перебором, поэтому hash не является безопасным сокрытием данных.

### Гарантирует ли `hashString128`, что коллизий не будет?

Нет. Более длинный результат уменьшает практический риск для non-adversarial сценариев, но математическая и security-гарантия отсутствует.

### Почему `Café` иногда даёт другой hash?

В Unicode визуально одинаковый текст может состоять из разных code points/code units. Модуль не выполняет normalization. Если домен требует равенства, приведите обе строки к одной форме, например NFC, до хеширования.

### Можно ли использовать `stringToElementId` для React label/input?

Можно при стабильном внешнем key, но для локальной связи внутри SSR React-компонента предпочтительнее `useId`.

### Уникален ли `stringToElementId` во всём документе?

Только если вызывающий код обеспечивает уникальные input/prefix и принимает риск hash-коллизии. Функция не проверяет уже существующие DOM IDs.

### Почему ID иногда содержит два дефиса подряд?

Один дефис добавляется после prefix, а Base64Url hash сам может начинаться с `-`. Это нормальный результат.

### Можно ли вызвать `uuidv4` на сервере?

Только если server runtime предоставляет совместимый global Web Crypto contract. Для переносимой server-логики используйте принятый в серверном проекте crypto API и проверьте, что формат/политика совпадают.

### Можно ли использовать UUID как React `key`?

Да, если UUID один раз сохранён в самой entity. Нельзя генерировать новый `uuidv4()` прямо внутри `.map()` на каждом render: ключи будут постоянно меняться, и React станет пересоздавать элементы.

### Нужно ли проверять UUID на конфликт в базе?

Да. Очень малая вероятность не заменяет unique constraint у authoritative storage.

### Стабильны ли exact hash между версиями пакета?

В рамках текущей реализации — да. Если вы сохраняете результат надолго или используете его как внешний протокол, версионируйте формат и зафиксируйте test vectors. Это позволит безопасно обнаружить или мигрировать будущую смену алгоритма.
