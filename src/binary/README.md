# Работа с бинарными данными через `@ryuzaki13/react-foundation-lib/binary`

Модуль `binary` преобразует строковое бинарное содержимое в браузерный `Blob`, определяет предполагаемый MIME-тип документа и предоставляет React hook для типового сценария «base64 → `{ blob, mime }`».

Основной сценарий:

1. backend возвращает содержимое файла строкой base64;
2. приложение определяет MIME-тип по имени файла, data URL или сигнатуре данных;
3. base64 декодируется в байты;
4. из байтов создаётся `Blob`;
5. вызывающий код передаёт `Blob` просмотрщику, скачивает файл или отправляет его дальше.

Модуль является предметно-независимым foundation-слоем. Он не знает бизнес-коды документов, не выполняет HTTP/OData-запросы, не загружает файлы с диска, не создаёт viewer и не проверяет, безопасно ли содержимое.

README рассчитан на разработчика, который использует опубликованный пакет без доступа к исходному коду. Здесь объясняются базовые понятия, все публичные функции, точный приоритет MIME, поддерживаемые форматы, ошибки, React lifecycle, безопасность и управление object URL.

## Содержание

- [Назначение и границы модуля](#назначение-и-границы-модуля)
- [Установка и импорт](#установка-и-импорт)
- [Минимальные понятия](#минимальные-понятия)
- [Как выбрать API](#как-выбрать-api)
- [Быстрый старт](#быстрый-старт)
- [Поддерживаемые входные форматы](#поддерживаемые-входные-форматы)
- [`binaryToBlob`](#binarytoblob)
- [`detectMimeType`](#detectmimetype)
- [`useBinaryFile`](#usebinaryfile)
- [Работа с готовым `Blob`](#работа-с-готовым-blob)
- [Готовые рецепты](#готовые-рецепты)
- [Ошибки и диагностика](#ошибки-и-диагностика)
- [Безопасность](#безопасность)
- [Производительность и память](#производительность-и-память)
- [Тестирование](#тестирование)
- [Краткий справочник API](#краткий-справочник-api)
- [Вопросы и ответы](#вопросы-и-ответы)

## Назначение и границы модуля

### Что делает `binary`

- принимает base64, base64 data URL или raw binary string;
- нормализует пробелы, URL-safe алфавит и отсутствующий base64 padding;
- создаёт `Blob`;
- предполагает MIME по имени файла, объявлению data URL или небольшой сигнатуре;
- предоставляет React hook для base64-данных.

### Чего модуль не делает

- не отправляет запросы и не получает данные с backend;
- не читает пользовательский `File` через `FileReader`;
- не скачивает `Blob` автоматически;
- не создаёт и не освобождает object URL;
- не выполняет полную проверку формата файла;
- не сканирует файл на вредоносное содержимое;
- не преобразует обычный Unicode-текст в UTF-8;
- не распаковывает ZIP, DOCX, XLSX или другие контейнеры;
- не исправляет ошибочный MIME из внешнего источника.

### Соседние модули

| Задача                                                           | Модуль                                                     |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Декодировать строковый base64/data URL в `Blob`                  | `@ryuzaki13/react-foundation-lib/binary`                   |
| Прочитать выбранный пользователем `File`                         | `@ryuzaki13/react-foundation-lib/file`                     |
| Скачать готовый `Blob` или object URL                            | `@ryuzaki13/react-foundation-lib/dom`                      |
| Преобразовать base64 непосредственно в `Blob` без MIME-detection | `@ryuzaki13/react-foundation-lib/binary`                   |
| Полностью проверить структуру PDF, изображения или архива        | Специализированный parser/validator на доверенной boundary |

Не копируйте логику скачивания рядом с `binaryToBlob`. Для готового `Blob` уже существует `downloadFileFromBlob` в `/dom`.

## Установка и импорт

Установите пакет:

```bash
npm install @ryuzaki13/react-foundation-lib
```

Импортируйте API только из опубликованного subpath `/binary`:

```ts
import { binaryToBlob, detectMimeType, useBinaryFile } from "@ryuzaki13/react-foundation-lib/binary";
```

Корневой импорт пакета не поддерживается:

```ts
// Неправильно.
import { binaryToBlob } from "@ryuzaki13/react-foundation-lib";

// Правильно.
import { binaryToBlob } from "@ryuzaki13/react-foundation-lib/binary";
```

### React peer-зависимость

Entrypoint `/binary` экспортирует `useBinaryFile` и поэтому загружает React API. В текущем контракте пакета consumer должен предоставить совместимый React peer `>=19.2.0 <20.0.0`, даже если конкретный файл импортирует только `binaryToBlob` или `detectMimeType`.

Для React-приложения зависимость обычно уже установлена:

```bash
npm install react react-dom
```

Не подключайте отдельную вторую копию React ради этого модуля. Версия должна согласовываться с React host-приложения.

### Runtime

Модуль ориентирован на браузер и использует:

- `atob`;
- `Blob`;
- `ArrayBuffer`;
- `Uint8Array`;
- React 19 hooks для `useBinaryFile`.

В тестовой или серверной среде эти Web APIs могут отсутствовать либо вести себя иначе. Наличие похожих globals в конкретной версии Node.js не превращает browser contract в гарантированный server API.

## Минимальные понятия

### Байт

Байт — целое число от `0` до `255`. Файл на низком уровне является последовательностью байтов.

Например, ASCII-строка `"ABC"` представлена байтами:

| Символ | Код байта |
| ------ | --------: |
| `A`    |      `65` |
| `B`    |      `66` |
| `C`    |      `67` |

### Бинарные данные

Бинарные данные — произвольные байты файла: PDF, изображения, архивы, офисные документы и так далее. Не каждый набор байтов является корректным текстом.

### Base64

Base64 кодирует байты ограниченным набором печатных символов:

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
0123456789
+/
```

Пример:

```text
байты текста "Hello" → SGVsbG8=
```

Base64 не шифрует данные и не делает их безопасными. Любой, кто получил строку, может декодировать содержимое.

### Padding `=`

В конце стандартного base64 могут находиться один или два символа `=`. Они дополняют длину строки до блока из четырёх символов.

Модуль умеет добавить отсутствующий padding:

```text
SGVsbG8   → SGVsbG8=
```

Строка, длина которой после нормализации даёт остаток `1` при делении на `4`, не может быть корректно дополнена и отклоняется.

### URL-safe base64

URL-safe вариант заменяет:

- `+` на `-`;
- `/` на `_`.

Модуль возвращает эти символы в стандартный base64-алфавит перед декодированием.

### Data URL

Data URL содержит metadata и данные в одной строке:

```text
data:application/pdf;base64,JVBERi0xLjc...
```

Структура:

```text
data:<MIME>;base64,<payload>
```

Модуль поддерживает только base64 data URL с обязательным маркером `;base64,`. Обычный percent-encoded data URL вида `data:text/plain,Hello%20world` не поддерживается.

### MIME-тип

MIME сообщает, как интерпретировать содержимое:

| MIME                       | Тип содержимого                |
| -------------------------- | ------------------------------ |
| `application/pdf`          | PDF                            |
| `image/png`                | PNG                            |
| `text/plain`               | Обычный текст                  |
| `application/zip`          | ZIP                            |
| `application/octet-stream` | Неопределённые бинарные данные |

MIME — metadata, а не доказательство реального формата. Строка может заявлять `image/png`, хотя внутри находится другой файл.

### `Blob`

`Blob` — браузерный объект, который хранит последовательность байтов и MIME:

```ts
const blob = new Blob([new Uint8Array([65, 66, 67])], { type: "text/plain" });
```

У `Blob` есть:

- `blob.type` — MIME;
- `blob.size` — размер в байтах;
- `blob.text()` — прочитать как текст;
- `blob.arrayBuffer()` — получить байты.

### Object URL

Object URL — временная браузерная ссылка на `Blob`:

```ts
const objectUrl = URL.createObjectURL(blob);
```

Она похожа на:

```text
blob:https://example.test/...
```

Object URL не содержит base64 и не является data URL. После использования его нужно освободить:

```ts
URL.revokeObjectURL(objectUrl);
```

Сам `Blob` не требует ручного `revoke`; освобождать нужно созданные через `URL.createObjectURL` URL.

### Raw binary string

Raw binary string — JavaScript-строка, в которой код каждого символа рассматривается как один байт.

```ts
const raw = String.fromCharCode(65, 66, 67);
```

Это не обычная Unicode-строка и не UTF-8. Режим нужен только для legacy API, которые уже вернули байты в такой форме.

## Как выбрать API

| Нужно                                                  | Использовать                                      |
| ------------------------------------------------------ | ------------------------------------------------- |
| Превратить base64 в `Blob`                             | `binaryToBlob`                                    |
| Превратить base64 data URL в `Blob`                    | `binaryToBlob`                                    |
| Превратить raw binary string в `Blob`                  | `binaryToBlob(..., ..., false)`                   |
| Предположить MIME по имени и данным                    | `detectMimeType`                                  |
| В React получить `{ blob, mime }` из base64 prop/state | `useBinaryFile`                                   |
| Скачать готовый `Blob`                                 | `downloadFileFromBlob` из `/dom`                  |
| Прочитать пользовательский `File`                      | `readFile` или `readImageFile` из `/file`         |
| Использовать известные filename и MIME                 | Вызвать `detectMimeType`/`binaryToBlob` вручную   |
| Полностью проверить файл                               | Специализированный validator, не `detectMimeType` |

## Быстрый старт

### Base64 и имя файла

```ts
import { binaryToBlob, detectMimeType } from "@ryuzaki13/react-foundation-lib/binary";
import { downloadFileFromBlob } from "@ryuzaki13/react-foundation-lib/dom";

type BackendFile = {
	fileName: string;
	fileContent: string;
};

function downloadBackendFile(file: BackendFile) {
	const mime = detectMimeType(file.fileName, file.fileContent);
	const blob = binaryToBlob(file.fileContent, mime);

	downloadFileFromBlob(file.fileName, blob);
}
```

### Base64 data URL

```ts
const dataUrl = "data:text/plain;base64,SGVsbG8=";

const mime = detectMimeType(undefined, dataUrl);
const blob = binaryToBlob(dataUrl, mime);

console.log(mime); // "text/plain"
console.log(blob.type); // "text/plain"
console.log(await blob.text()); // "Hello"
```

Важно: `binaryToBlob(dataUrl)` самостоятельно не возьмёт MIME из data URL. Без второго аргумента `blob.type` будет `application/octet-stream`.

### Общий поток

```text
fileName ───────────────────────┐
                               ├─> detectMimeType ─> MIME ─┐
base64 / base64 data URL ──────┘                           │
                                                          ├─> Blob
base64 / base64 data URL ─────────> binaryToBlob ─────────┘
                                                             │
                                                             ├─> viewer
                                                             ├─> download
                                                             └─> FormData
```

## Поддерживаемые входные форматы

| Вход                            | Поддержка                       | Пример/комментарий                               |
| ------------------------------- | ------------------------------- | ------------------------------------------------ |
| Стандартный base64              | Да                              | `SGVsbG8=`                                       |
| Base64 без padding              | Да                              | `SGVsbG8`                                        |
| Base64 с пробелами и переносами | Да                              | Пробельные символы удаляются                     |
| URL-safe base64                 | Да                              | `-` и `_` заменяются на `+` и `/`                |
| Base64 data URL                 | Да                              | `data:image/png;base64,...`                      |
| Data URL с параметрами          | Да                              | `data:text/plain;charset=utf-8;base64,...`       |
| Data URL без MIME               | Да                              | `data:;base64,...`                               |
| Raw binary string               | Да, только с `isBase64 = false` | Каждый JS-символ превращается в один байт        |
| Обычная Unicode-строка          | Нет как raw binary              | Это не UTF-8 encoder                             |
| Percent-encoded data URL        | Нет                             | `data:text/plain,Hello%20world`                  |
| Hex-строка                      | Нет                             | `25504446` не трактуется как байты PDF           |
| `Uint8Array`                    | Нет                             | API принимает `string`; создайте `Blob` напрямую |
| `ArrayBuffer`                   | Нет                             | API принимает `string`; создайте `Blob` напрямую |
| Пустая строка                   | Нет                             | Выбрасывается ошибка                             |

## `binaryToBlob`

### Сигнатура

```ts
function binaryToBlob(binaryData: string, mimeType?: string, isBase64?: boolean): Blob;
```

Фактические значения по умолчанию:

```ts
mimeType = "application/octet-stream";
isBase64 = true;
```

### Параметры

| Параметр     | Тип       | По умолчанию               | Назначение                                             |
| ------------ | --------- | -------------------------- | ------------------------------------------------------ |
| `binaryData` | `string`  | Обязательный               | Base64/data URL или raw binary string                  |
| `mimeType`   | `string`  | `application/octet-stream` | MIME создаваемого `Blob`                               |
| `isBase64`   | `boolean` | `true`                     | Декодировать base64 или читать коды символов как байты |

### Результат

Возвращается новый непустой `Blob`.

```ts
const blob = binaryToBlob("SGVsbG8=", "text/plain");

console.log(blob.size); // 5
console.log(blob.type); // "text/plain"
console.log(await blob.text()); // "Hello"
```

Функция синхронная. Методы чтения самого `Blob`, например `text()` и `arrayBuffer()`, возвращают `Promise`.

### Что происходит в base64-режиме

При `isBase64 = true` функция:

1. проверяет, не является ли строка base64 data URL;
2. для data URL отделяет payload после запятой;
3. удаляет все пробельные символы;
4. заменяет URL-safe `-` и `_`;
5. проверяет допустимый алфавит и padding;
6. добавляет отсутствующий padding;
7. декодирует строку браузерным `atob`;
8. переносит коды полученной binary string в `Uint8Array`;
9. копирует байты в отдельный `ArrayBuffer`;
10. создаёт `Blob` с переданным MIME.

### Обычный base64

```ts
const blob = binaryToBlob("SGVsbG8=", "text/plain");

console.log(await blob.text()); // "Hello"
```

### Пробелы и переносы строк

Пробельные символы удаляются во всей base64-строке:

```ts
const blob = binaryToBlob("SGVs\n bG8=\t", "text/plain");

console.log(await blob.text()); // "Hello"
```

Это удобно для MIME-wrapped base64, но не исправляет данные, в которых символ `+` был случайно заменён пробелом при URL/form-декодировании. В таком случае байт будет потерян.

### Отсутствующий padding

```ts
const blob = binaryToBlob("SGVsbG8", "text/plain");

console.log(await blob.text()); // "Hello"
```

### URL-safe base64

```ts
const blob = binaryToBlob("__8", "application/octet-stream");

const bytes = new Uint8Array(await blob.arrayBuffer());

console.log([...bytes]); // [255, 255]
```

### Data URL

```ts
const dataUrl = "data:text/plain;base64,SGVsbG8=";

const blob = binaryToBlob(dataUrl, "text/plain");

console.log(await blob.text()); // "Hello"
```

Поддерживается data URL с дополнительными параметрами:

```ts
const dataUrl = "data:text/plain;charset=utf-8;base64,SGVsbG8=";
```

Распознавание префикса выполняется без учёта регистра для `data:` и `base64`.

### MIME data URL не применяется автоматически

`binaryToBlob` отделяет payload data URL, но намеренно использует только аргумент `mimeType`:

```ts
const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

const blob = binaryToBlob(dataUrl);

console.log(blob.type);
// "application/octet-stream"
```

Для использования MIME из data URL сначала вызовите `detectMimeType`:

```ts
const mime = detectMimeType(undefined, dataUrl);
const blob = binaryToBlob(dataUrl, mime);
```

### Пустой MIME

`undefined`, пустая строка или строка только из пробелов приводят к `application/octet-stream`:

```ts
binaryToBlob("SGVsbG8=", undefined).type;
// "application/octet-stream"

binaryToBlob("SGVsbG8=", "").type;
// "application/octet-stream"

binaryToBlob("SGVsbG8=", "   ").type;
// "application/octet-stream"
```

Непустой MIME передаётся в конструктор `Blob` после `trim()`. Окончательная нормализация `blob.type` выполняется браузерной реализацией `Blob`.

### Raw binary string

Чтобы отключить base64-декодирование:

```ts
const blob = binaryToBlob("ABC", "application/octet-stream", false);

const bytes = new Uint8Array(await blob.arrayBuffer());

console.log([...bytes]); // [65, 66, 67]
```

Каждый UTF-16 code unit строки записывается в `Uint8Array`. Значения больше `255` обрезаются до младшего байта.

Поэтому обычный Unicode-текст нельзя передавать как raw binary:

```ts
// Неправильно для UTF-8.
binaryToBlob("Привет", "text/plain", false);
```

Для текста используйте `TextEncoder` и создайте `Blob` напрямую:

```ts
const bytes = new TextEncoder().encode("Привет");
const blob = new Blob([bytes], { type: "text/plain;charset=utf-8" });
```

### Функция не выполняет MIME-detection

```ts
const blob = binaryToBlob(pdfBase64);

console.log(blob.type);
// "application/octet-stream", даже если внутри PDF.
```

Если MIME неизвестен:

```ts
const mime = detectMimeType(fileName, pdfBase64);
const blob = binaryToBlob(pdfBase64, mime);
```

### Ошибки

| Условие                                                | Сообщение                                 |
| ------------------------------------------------------ | ----------------------------------------- |
| `binaryData === ""`                                    | `Не переданы бинарные данные`             |
| После удаления префикса/пробелов payload пуст          | `После преобразования не осталось данных` |
| Недопустимый base64-символ                             | `Некорректный формат base64`              |
| Длина base64 имеет невозможный остаток                 | `Некорректный формат base64`              |
| `atob` отклонил редкий синтаксически прошедший вариант | Сообщение browser `DOMException`          |
| Низкоуровневый API выбросил не-`Error`                 | `Некорректный формат бинарных данных`     |

Пример обработки:

```ts
try {
	const blob = binaryToBlob(payload, "application/pdf");

	showDocument(blob);
} catch (error) {
	const message = error instanceof Error ? error.message : "Не удалось декодировать файл";

	showError(message);
}
```

Не включайте исходную base64-строку в сообщение, лог или error report: она может содержать персональные или конфиденциальные данные.

## `detectMimeType`

### Сигнатура

```ts
function detectMimeType(fileName?: string, binaryData?: string): string;
```

Функция всегда возвращает строку и не выбрасывает ошибку для неизвестного либо некорректного base64. Если MIME определить не удалось, возвращается `application/pdf`.

### Приоритет источников

Проверки выполняются строго в таком порядке:

| Приоритет | Источник                        | Когда используется                |
| --------: | ------------------------------- | --------------------------------- |
|         1 | Расширение `fileName`           | Расширение известно таблице       |
|         2 | MIME из base64 data URL         | Filename не дал известный MIME    |
|         3 | Сигнатура декодированных данных | Data URL не объявил непустой MIME |
|         4 | Fallback PDF                    | Ничего не распознано              |

Первый успешный источник побеждает. Функция не сравнивает источники между собой.

```ts
const pngDataUrl = "data:image/png;base64,iVBORw0KGgo=";

detectMimeType("report.pdf", pngDataUrl);
// "application/pdf": расширение filename имеет приоритет.
```

### MIME по расширению файла

Поддерживается последняя часть имени после точки. Регистр не важен.

| Расширение | MIME                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| `bmp`      | `image/bmp`                                                                 |
| `csv`      | `text/csv`                                                                  |
| `doc`      | `application/msword`                                                        |
| `docx`     | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`   |
| `gif`      | `image/gif`                                                                 |
| `jpeg`     | `image/jpeg`                                                                |
| `jpg`      | `image/jpeg`                                                                |
| `json`     | `application/json`                                                          |
| `pdf`      | `application/pdf`                                                           |
| `png`      | `image/png`                                                                 |
| `ppt`      | `application/vnd.ms-powerpoint`                                             |
| `pptx`     | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `svg`      | `image/svg+xml`                                                             |
| `tif`      | `image/tiff`                                                                |
| `tiff`     | `image/tiff`                                                                |
| `txt`      | `text/plain`                                                                |
| `webp`     | `image/webp`                                                                |
| `xls`      | `application/vnd.ms-excel`                                                  |
| `xlsx`     | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`         |
| `xml`      | `application/xml`                                                           |
| `zip`      | `application/zip`                                                           |

Примеры:

```ts
detectMimeType("report.xlsx");
// "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

detectMimeType("PHOTO.JPG");
// "image/jpeg"

detectMimeType("archive.backup.zip");
// "application/zip"
```

Filename не очищается от query/hash и пробелов:

```ts
detectMimeType("photo.jpg?download=1");
// "application/pdf", если binaryData не передан.

detectMimeType("photo.jpg ");
// "application/pdf", если binaryData не передан.
```

Передавайте именно имя файла, а не URL. Если есть URL, сначала безопасно извлеките pathname/filename на соответствующей boundary.

### MIME из data URL

```ts
const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

detectMimeType(undefined, dataUrl);
// "image/png"
```

Для параметров используется только часть до первого `;`:

```ts
const dataUrl = "data:text/plain;charset=utf-8;base64,SGVsbG8=";

detectMimeType(undefined, dataUrl);
// "text/plain"
```

Если MIME пуст:

```ts
const dataUrl = "data:;base64,JVBERi0xLjc=";

detectMimeType(undefined, dataUrl);
// Проверка продолжится по сигнатуре.
```

Объявленный MIME возвращается без декодирования и проверки payload:

```ts
detectMimeType(undefined, "data:image/png;base64,not-valid-base64");
// "image/png"
```

Поэтому data URL MIME нельзя считать доказательством формата.

### MIME по сигнатуре

Если filename и data URL не дали тип, функция пытается декодировать начало base64. Ошибка декодирования скрывается, после чего используется fallback.

Проверяются следующие признаки:

| Начало данных                                      | Результат         | Ограничение                                        |
| -------------------------------------------------- | ----------------- | -------------------------------------------------- |
| bytes `25 50 44 46` (`%PDF`)                       | `application/pdf` | Проверяются только первые четыре байта             |
| bytes `FF D8 FF`                                   | `image/jpeg`      | Проверяются только первые три байта                |
| bytes `89 50 4E 47`                                | `image/png`       | Полная восьмибайтовая PNG signature не проверяется |
| текст `GIF`                                        | `image/gif`       | Версия `87a/89a` не проверяется                    |
| текст `RIFF`                                       | `image/webp`      | Маркер `WEBP` дальше в header не проверяется       |
| bytes `50 4B` (`PK`)                               | `application/zip` | OOXML-файлы без filename тоже выглядят как ZIP     |
| первый непустой текст начинается с `<?xml` или `<` | `application/xml` | HTML и SVG тоже могут попасть в эту ветку          |

Примеры:

```ts
detectMimeType(undefined, pdfBase64);
// "application/pdf"

detectMimeType(undefined, jpegBase64);
// "image/jpeg"

detectMimeType(undefined, zipBase64);
// "application/zip"
```

DOCX, XLSX и PPTX являются ZIP-контейнерами. Без имени файла они обычно определятся как `application/zip`, а не как конкретный Office MIME.

Любое RIFF-содержимое соответствует текущей короткой проверке и может быть ошибочно определено как `image/webp`. Например, WAV/AVI без filename не должны доверять этому результату.

Текст, начинающийся после пробелов с `<`, считается XML-подобным. Это эвристика, а не XML parser.

### Fallback

Если ничего не распознано:

```ts
detectMimeType();
// "application/pdf"

detectMimeType(undefined, "не base64");
// "application/pdf"

detectMimeType("unknown.bin");
// "application/pdf"
```

Fallback PDF является осознанным предметно-независимым default текущего контракта, оптимизированным под документные сценарии пакета. Это не означает, что неизвестные данные действительно являются PDF.

Если вызывающий код не может принимать такое предположение, он должен:

- требовать известный MIME от backend;
- валидировать формат специализированным parser;
- или применять собственный fallback после отдельной проверки.

### `detectMimeType` не является validator

Функция отвечает только на вопрос «какой MIME предположить». Она не отвечает на вопросы:

- полностью ли корректен файл;
- соответствует ли содержимое расширению;
- безопасно ли показывать файл;
- не повреждён ли архив;
- разрешён ли тип бизнес-правилами;
- можно ли доверять MIME из внешнего источника.

## `useBinaryFile`

### Сигнатура

```ts
function useBinaryFile(bin: string | undefined): {
	data: {
		blob: Blob;
		mime: string;
	} | null;
	error: string | null;
};
```

Hook принимает только base64/base64 data URL. Он всегда вызывает:

```ts
const mime = detectMimeType(undefined, bin);
const blob = binaryToBlob(bin, mime, true);
```

Filename передать нельзя, raw binary mode использовать нельзя.

### Возвращаемое состояние

| Поле    | Значение         | Смысл                                |
| ------- | ---------------- | ------------------------------------ |
| `data`  | `{ blob, mime }` | Декодирование завершилось успешно    |
| `data`  | `null`           | Нет результата либо произошла ошибка |
| `error` | `string`         | Строковое представление ошибки       |
| `error` | `null`           | Ошибки нет                           |

### Lifecycle

Преобразование выполняется после commit в React effect:

1. первый render возвращает `{ data: null, error: null }`;
2. после commit effect обрабатывает `bin`;
3. успех записывает `{ blob, mime }` и очищает ошибку;
4. ошибка очищает `data` и записывает `String(error)`;
5. `undefined` или пустая строка очищают оба поля.

Пример последовательности:

| `bin`                 | Состояние после effect                                     |
| --------------------- | ---------------------------------------------------------- |
| `undefined`           | `{ data: null, error: null }`                              |
| `""`                  | `{ data: null, error: null }`                              |
| Корректный base64 PDF | `{ data: { blob, mime: "application/pdf" }, error: null }` |
| Некорректный base64   | `{ data: null, error: "Error: ..." }`                      |
| Строка из пробелов    | Ошибка после удаления пробелов                             |

У hook нет отдельного `isLoading`/`isProcessing`. На первом render `data: null` и `error: null` может означать как отсутствие входа, так и ещё не выполненный effect.

### Смена `bin`

При смене одного непустого `bin` на другой предыдущие `data`/`error` могут оставаться видимыми до выполнения следующего effect. Hook не очищает состояние синхронно во время render.

Если нельзя кратковременно показать предыдущий документ:

- разместите hook в компоненте, который remount-ится по стабильному ID документа;
- или выполните преобразование на явной границе загрузки;
- или добавьте внешний state machine с identity результата.

Не используйте саму большую base64-строку как React `key`. Используйте безопасный стабильный ID документа:

```tsx
<BinaryDocument key={document.id} bin={document.content} />
```

### Определение MIME внутри hook

Hook не знает filename. Приоритет будет таким:

1. MIME из data URL;
2. сигнатура;
3. fallback `application/pdf`.

Обычный base64 текста без data URL и известной сигнатуры станет `Blob` с `application/pdf`:

```tsx
const { data } = useBinaryFile("SGVsbG8=");

// После effect:
// data?.mime === "application/pdf"
```

Если известны имя или MIME, вызывайте `detectMimeType` и `binaryToBlob` вручную.

### Ошибки и logging

При ошибке hook:

1. вызывает внутренний `logError(error)`;
2. `logError` пишет ошибку в `console.error`;
3. возвращает `error: String(error)`;
4. очищает `data`.

Для обычного `Error` строка включает имя:

```text
Error: Некорректный формат base64
```

Не сравнивайте `error` с точным текстом browser `DOMException`: сообщение низкоуровневого `atob` может отличаться между средами.

### Базовое использование

```tsx
import { useBinaryFile } from "@ryuzaki13/react-foundation-lib/binary";

type BinaryDocumentProps = {
	readonly bin: string | undefined;
};

export function BinaryDocument(props: BinaryDocumentProps) {
	const { data, error } = useBinaryFile(props.bin);

	if (error) {
		return <p role="alert">Не удалось подготовить документ</p>;
	}

	if (!props.bin) {
		return <p>Документ не передан</p>;
	}

	if (!data) {
		return <p>Подготовка документа…</p>;
	}

	return <DocumentViewer blob={data.blob} mime={data.mime} />;
}
```

`DocumentViewer` в примере — компонент host-приложения. Пакет `binary` его не предоставляет.

### Hook не создаёт object URL

`Blob` можно передать компоненту, который принимает его напрямую. Если viewer требует строковый URL, вызывающий компонент отвечает за создание и cleanup.

Корректная синхронизация с `iframe`:

```tsx
import { useEffect, useRef } from "react";

type BlobFrameProps = {
	readonly blob: Blob;
	readonly title: string;
};

export function BlobFrame(props: BlobFrameProps) {
	const frameRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		const frame = frameRef.current;

		if (!frame) return;

		const objectUrl = URL.createObjectURL(props.blob);

		frame.src = objectUrl;

		return () => {
			frame.removeAttribute("src");
			URL.revokeObjectURL(objectUrl);
		};
	}, [props.blob]);

	return <iframe ref={frameRef} title={props.title} />;
}
```

Effect синхронизирует React с внешним browser API и симметрично освобождает URL. Такой cleanup устойчив к повторному setup/cleanup в React Strict Mode.

### Когда hook не подходит

Не используйте `useBinaryFile`, если:

- код выполняется вне React;
- MIME уже известен и не равен PDF fallback;
- нужно учитывать filename;
- данные являются raw binary string;
- результат нужен немедленно в event handler;
- нужен явный processing/error state machine;
- преобразование большого payload нужно вынести с main thread.

## Работа с готовым `Blob`

### Скачать файл

Используйте `/dom`:

```ts
import { downloadFileFromBlob } from "@ryuzaki13/react-foundation-lib/dom";

downloadFileFromBlob(fileName, blob);
```

Helper создаёт object URL, запускает скачивание и освобождает URL.

### Передать в viewer

Если viewer принимает `Blob`:

```tsx
<DocumentViewer blob={blob} mime={blob.type} />
```

Если viewer принимает URL, создайте object URL на его lifecycle boundary и обязательно выполните cleanup.

### Прочитать байты

```ts
const buffer = await blob.arrayBuffer();
const bytes = new Uint8Array(buffer);

console.log(bytes.length);
```

### Прочитать текст

```ts
const text = await blob.text();
```

`blob.text()` декодирует данные как текст. Для PDF, ZIP и изображений результат не имеет полезного смысла.

### Отправить через `FormData`

```ts
const formData = new FormData();

formData.append("file", blob, fileName);
```

Transport, authentication и обработка ответа не принадлежат модулю `binary`.

### Object URL cleanup

Неправильно:

```ts
const src = URL.createObjectURL(blob);
image.src = src;

// URL никогда не освобождается.
```

Правильно:

```ts
const src = URL.createObjectURL(blob);
image.src = src;

// Когда URL больше не нужен:
image.removeAttribute("src");
URL.revokeObjectURL(src);
```

Не вызывайте `revokeObjectURL` до того, как consumer закончил использовать URL.

## Готовые рецепты

### Скачать backend-файл с известным именем

```ts
import { binaryToBlob, detectMimeType } from "@ryuzaki13/react-foundation-lib/binary";
import { downloadFileFromBlob } from "@ryuzaki13/react-foundation-lib/dom";

function downloadFile(fileName: string, fileContent: string) {
	const mime = detectMimeType(fileName, fileContent);
	const blob = binaryToBlob(fileContent, mime);

	downloadFileFromBlob(fileName, blob);
}
```

### Создать PDF Blob при известном контракте backend

Если backend-контракт гарантирует PDF, detection не нужен:

```ts
const blob = binaryToBlob(fileContent, "application/pdf");
```

Это надёжнее эвристики, если MIME гарантирован и проверяется владельцем transport/domain boundary.

### Обработать data URL

```ts
function dataUrlToBlob(dataUrl: string) {
	const mime = detectMimeType(undefined, dataUrl);

	return binaryToBlob(dataUrl, mime);
}
```

### Обработать URL-safe base64

```ts
const blob = binaryToBlob(urlSafePayload, "application/octet-stream");
```

Дополнительных замен в consumer-коде не требуется.

### Обработать raw binary string

```ts
const blob = binaryToBlob(rawBinaryString, "application/pdf", false);
```

Используйте только когда upstream явно гарантирует raw binary string.

### Показать base64-документ в React

```tsx
function DocumentPanel(props: { readonly documentId: string; readonly base64: string | undefined }) {
	return <BinaryDocument key={props.documentId} bin={props.base64} />;
}
```

### Отладочно проверить первые байты

```ts
const blob = binaryToBlob(payload, "application/octet-stream");
const bytes = new Uint8Array(await blob.arrayBuffer());

console.log([...bytes.slice(0, 8)]);
```

Не оставляйте logging бинарного содержимого в production-коде.

## Ошибки и диагностика

### «Не переданы бинарные данные»

Причина:

```ts
binaryToBlob("");
```

Решение: различайте отсутствие payload и корректное содержимое до вызова функции.

### «После преобразования не осталось данных»

Причины:

- data URL имеет пустой payload;
- base64 состоит только из пробелов;
- после удаления whitespace не осталось символов.

```ts
binaryToBlob("data:text/plain;base64,");
```

### «Некорректный формат base64»

Причины:

- присутствуют недопустимые символы;
- строка имеет невозможную длину;
- передан обычный текст вместо base64;
- передан percent-encoded data URL;
- payload был повреждён transport-слоем.

```ts
binaryToBlob("not valid *");
```

### Base64 из query/form потерял `+`

В `application/x-www-form-urlencoded` символ `+` может интерпретироваться как пробел. Модуль удалит пробел и не сможет восстановить потерянный байт.

Передавайте base64:

- в JSON body;
- как URL-safe base64;
- или с корректным percent-encoding.

### `Blob.type` равен `application/octet-stream`

Причина: `binaryToBlob` не выполняет detection и не использует MIME data URL автоматически.

Решение:

```ts
const mime = detectMimeType(fileName, payload);
const blob = binaryToBlob(payload, mime);
```

### Hook определил текст как PDF

Причина: `useBinaryFile` не получает filename, сигнатура текста неизвестна, поэтому применяется PDF fallback.

Решения:

- передать data URL с MIME;
- вызвать функции вручную с известным MIME;
- не использовать hook для этого контракта.

### MIME не совпал с содержимым

Проверьте приоритет:

1. filename;
2. data URL;
3. signature;
4. PDF fallback.

Известное расширение filename всегда выигрывает, даже если данные заявляют другой тип.

### Data URL не распознан

Поддерживается форма:

```text
data:<mime>[;parameters];base64,<payload>
```

Не поддерживается:

```text
data:<mime>,<percent-encoded-payload>
```

### Ошибка появляется в `console.error`

Это текущее поведение `useBinaryFile`: hook логирует пойманную ошибку перед записью `error` state. Для ручного `binaryToBlob` logging не выполняется.

### Object URL перестал работать

Проверьте, что:

- URL не был освобождён слишком рано;
- cleanup старого URL не затронул новый URL;
- `Blob` ещё соответствует текущему документу;
- browser CSP/viewer разрешает `blob:` source.

## Безопасность

### MIME нельзя использовать как проверку безопасности

Следующие источники контролируемы внешними данными:

- filename;
- MIME data URL;
- первые байты payload.

`detectMimeType` не гарантирует, что файл безопасен или соответствует типу.

### Активное содержимое

SVG, HTML, XML и некоторые PDF могут содержать активные или внешние ссылки. Не вставляйте непроверенное содержимое напрямую в DOM.

Для недоверенных файлов:

- используйте безопасный viewer;
- учитывайте sandbox/CSP;
- запрещайте опасные типы на доверенной server boundary;
- не полагайтесь только на расширение;
- не выполняйте содержимое как script/module.

### Ограничивайте размер

Перед декодированием проверяйте допустимый размер ответа на transport/domain boundary. Base64 и несколько промежуточных копий могут значительно увеличить потребление памяти.

### Не логируйте payload

Base64 может содержать:

- персональные данные;
- договоры и документы;
- изображения;
- токены, если upstream ошибочно включил их;
- другие чувствительные сведения.

В diagnostics передавайте безопасные metadata: источник, ожидаемый тип, размер строки и технический код ошибки — без самого содержимого.

### Не доверяйте filename

Filename может содержать нежелательные символы или обманное расширение. Санитизация имени и бизнес-политика разрешённых форматов принадлежат boundary, которая принимает внешний файл.

## Производительность и память

### Синхронное декодирование

`binaryToBlob` синхронно:

- нормализует всю строку;
- вызывает `atob`;
- создаёт `Uint8Array`;
- создаёт отдельный `ArrayBuffer`;
- создаёт `Blob`.

Большой payload может заблокировать main thread и временно существовать в нескольких представлениях одновременно.

### Base64 больше исходных байтов

Base64 обычно примерно на треть больше исходного binary payload, не считая префикса data URL и JavaScript string storage.

### `detectMimeType` декодирует только начало

Signature detection декодирует ограниченное начало base64, поэтому дешевле полного декодирования. При этом распознавание data URL выполняется регулярным выражением над входной строкой и может просканировать весь payload. Последующий `binaryToBlob` в любом случае обрабатывает полный payload.

### Рекомендации

- ограничивайте размер на backend и transport boundary;
- не декодируйте один payload несколько раз без причины;
- не храните одновременно много больших base64-строк и `Blob`;
- освобождайте object URL;
- для действительно больших файлов предпочитайте streaming/download endpoint;
- не выполняйте тяжёлое декодирование каждого render;
- не используйте `useBinaryFile` как cache больших backend-файлов.

### Сложность

Для payload длины `n`:

- время `binaryToBlob` — `O(n)`;
- дополнительная память — `O(n)`;
- `detectMimeType` — `O(n)` в худшем случае из-за разбора data URL, хотя для signature декодируется только ограниченный header.

## Тестирование

### Тесты consumer-кода

Проверяйте:

- `blob.type`;
- `blob.size`;
- текст для текстового fixture;
- байты через `arrayBuffer()`;
- ожидаемые ошибки;
- cleanup object URL в UI boundary.

Пример:

```ts
import { describe, expect, it } from "vitest";

import { binaryToBlob, detectMimeType } from "@ryuzaki13/react-foundation-lib/binary";

describe("binary document", () => {
	it("создаёт текстовый Blob", async () => {
		const blob = binaryToBlob("SGVsbG8=", "text/plain");

		expect(blob.type).toBe("text/plain");
		expect(await blob.text()).toBe("Hello");
	});

	it("определяет PDF по имени", () => {
		expect(detectMimeType("report.pdf")).toBe("application/pdf");
	});
});
```

Тестовая среда должна предоставлять `Blob`, `atob` и при UI-тестах React DOM. В пакете pure-функции проверяются в `jsdom`.

### Узкий тест пакета

```bash
npm run test -- src/binary/binaryToBlob.test.ts
```

## Краткий справочник API

Полный импорт:

```ts
import { binaryToBlob, detectMimeType, useBinaryFile } from "@ryuzaki13/react-foundation-lib/binary";
```

| API              | Вход                            | Результат         | Ошибка                                   |
| ---------------- | ------------------------------- | ----------------- | ---------------------------------------- |
| `binaryToBlob`   | Строка, MIME, base64/raw флаг   | Непустой `Blob`   | Выбрасывает `Error`/browser decode error |
| `detectMimeType` | Filename и/или base64/data URL  | MIME string       | Не выбрасывает; fallback PDF             |
| `useBinaryFile`  | Base64/data URL или `undefined` | `{ data, error }` | Логирует и возвращает строку ошибки      |

### Defaults

| Контракт                           | Значение                   |
| ---------------------------------- | -------------------------- |
| `binaryToBlob` MIME                | `application/octet-stream` |
| `binaryToBlob` input mode          | base64                     |
| `detectMimeType` fallback          | `application/pdf`          |
| `useBinaryFile` initial `data`     | `null`                     |
| `useBinaryFile` initial `error`    | `null`                     |
| `useBinaryFile` raw binary support | Нет                        |
| Автоматическое создание object URL | Нет                        |

## Вопросы и ответы

### Base64 — это шифрование?

Нет. Это текстовое кодирование байтов. Оно не обеспечивает секретность, целостность или подлинность.

### Почему `binaryToBlob` не определяет MIME сам?

Преобразование байтов и выбор MIME являются разными ответственностями. Вызывающий код может знать MIME точнее любой эвристики. Для предположения существует отдельная `detectMimeType`.

### Почему fallback у `binaryToBlob` и `detectMimeType` разный?

`binaryToBlob` без информации создаёт нейтральный `application/octet-stream`. `detectMimeType` ориентирован на документный контур и возвращает `application/pdf`, если эвристики не сработали.

### Почему MIME data URL не попал в `Blob`?

`binaryToBlob` использует data URL только для извлечения base64 payload. Передайте MIME вторым аргументом:

```ts
const mime = detectMimeType(undefined, dataUrl);
const blob = binaryToBlob(dataUrl, mime);
```

### Почему DOCX определился как ZIP?

DOCX, XLSX и PPTX технически являются ZIP-контейнерами. Без filename короткая signature видит только `PK`. Передавайте корректное имя или известный MIME.

### Почему неизвестный файл определился как PDF?

Это fallback `detectMimeType`. Он не доказывает, что файл является PDF.

### Можно ли передать `Uint8Array`?

Нет, публичный API принимает строку. Для готовых байтов создайте `Blob` напрямую:

```ts
const blob = new Blob([bytes], { type: mime });
```

### Можно ли передать обычный текст?

Если текст уже корректно закодирован в base64 — да. Raw mode не является UTF-8 encoder. Для обычного Unicode-текста используйте `TextEncoder`.

### Нужно ли вручную освобождать `Blob`?

Нет. Нужно освобождать object URL, созданный через `URL.createObjectURL(blob)`.

### Создаёт ли `useBinaryFile` object URL?

Нет. Hook возвращает только `Blob` и MIME.

### Можно ли использовать `useBinaryFile` вне React-компонента?

Нет. Это React hook, к нему применяются Rules of Hooks. Для обычной функции используйте `binaryToBlob` и `detectMimeType`.

### Почему entrypoint требует React, если нужна только pure-функция?

Текущий `/binary` entrypoint также экспортирует `useBinaryFile`, а собранный ESM-модуль импортирует React. Поэтому React должен быть доступен при разрешении entrypoint.

### Валидирует ли `detectMimeType` файл?

Нет. Это только эвристический выбор MIME.

### Можно ли использовать результат для проверки разрешённого типа?

Не как единственную проверку. Политику разрешённых форматов и проверку недоверенного содержимого выполняйте на доверенной boundary.

### Что выбрать: data URL или object URL?

Data URL содержит данные внутри строки и часто приходит извне. Object URL является временной ссылкой браузера на уже созданный `Blob`. Для отображения большого `Blob` обычно удобнее object URL с обязательным cleanup.
