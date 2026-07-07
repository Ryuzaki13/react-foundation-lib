# Библиотека чтения файлов

Библиотека для безопасного чтения файлов на клиенте через `FileReader` API с валидацией, поддержкой отмены и строгой типизацией.

## Структура

```
src/shared/lib/file/
├── read-file/          — универсальное чтение любых файлов
│   ├── types.ts
│   ├── readFile.ts
│   └── index.ts
├── image/              — чтение изображений (надстройка над read-file)
│   ├── types.ts
│   ├── readImageFile.ts
│   └── index.ts
└── index.ts
```

Все экспорты доступны через `@/shared/lib`.

---

## `readFile` — чтение любых файлов

Универсальная функция для чтения файлов. Поддерживает два режима: `data-url` (по умолчанию) и `array-buffer`.

### Сигнатуры

```ts
// Чтение как Data URL (по умолчанию)
readFile(file: File, opts?: { mode?: "data-url"; ... }): Promise<ReadFileAsDataUrlResult>

// Чтение как ArrayBuffer
readFile(file: File, opts: { mode: "array-buffer"; ... }): Promise<ReadFileAsArrayBufferResult>
```

### Опции (`ReadFileOptions`)

| Параметр      | Тип                            | По умолчанию | Описание                           |
| ------------- | ------------------------------ | ------------ | ---------------------------------- |
| `mode`        | `"data-url" \| "array-buffer"` | `"data-url"` | Режим чтения файла                 |
| `allowedMime` | `readonly string[]`            | —            | Список разрешённых MIME-типов      |
| `maxBytes`    | `number`                       | —            | Максимальный размер файла в байтах |
| `signal`      | `AbortSignal`                  | —            | Сигнал для отмены операции         |

### Результат

**`ReadFileAsDataUrlResult`** (при `mode: "data-url"`):

| Поле      | Тип          | Описание                      |
| --------- | ------------ | ----------------------------- |
| `mode`    | `"data-url"` | Дискриминант режима           |
| `meta`    | `FileMeta`   | Метаданные файла              |
| `dataUrl` | `string`     | Содержимое в формате Data URL |
| `file`    | `File`       | Исходный объект `File`        |

**`ReadFileAsArrayBufferResult`** (при `mode: "array-buffer"`):

| Поле     | Тип              | Описание               |
| -------- | ---------------- | ---------------------- |
| `mode`   | `"array-buffer"` | Дискриминант режима    |
| `meta`   | `FileMeta`       | Метаданные файла       |
| `buffer` | `ArrayBuffer`    | Бинарное содержимое    |
| `file`   | `File`           | Исходный объект `File` |

**`FileMeta`** — метаданные файла:

| Поле           | Тип      | Описание                               |
| -------------- | -------- | -------------------------------------- |
| `mime`         | `string` | MIME-тип файла                         |
| `size`         | `number` | Размер в байтах                        |
| `name`         | `string` | Имя файла                              |
| `lastModified` | `number` | Время последнего изменения (timestamp) |

### Примеры

**Чтение PDF-файла как Data URL для предпросмотра:**

```ts
import { readFile, ReadFileError } from "@/shared/lib";

async function handlePdfUpload(file: File) {
  try {
    const result = await readFile(file, {
      allowedMime: ["application/pdf"],
      maxBytes: 50 * 1024 * 1024, // 50 МБ
    });

    // result.mode === "data-url" (тип сужен автоматически)
    console.log(result.meta.name);   // "document.pdf"
    console.log(result.meta.size);   // 1234567
    previewIframe.src = result.dataUrl;
  } catch (error) {
    if (error instanceof ReadFileError) {
      console.error(error.code, error.message);
    }
  }
}
```

**Чтение файла как ArrayBuffer для отправки на сервер:**

```ts
import { readFile } from "@/shared/lib";

async function uploadDocument(file: File) {
  const result = await readFile(file, {
    mode: "array-buffer",
    maxBytes: 100 * 1024 * 1024, // 100 МБ
  });

  // result.buffer: ArrayBuffer (тип сужен автоматически)
  await fetch("/api/upload", {
    method: "POST",
    body: result.buffer,
    headers: { "Content-Type": result.meta.mime },
  });
}
```

**Чтение с поддержкой отмены:**

```ts
import { readFile } from "@/shared/lib";

const controller = new AbortController();

// Отмена через 5 секунд
setTimeout(() => controller.abort(), 5000);

const result = await readFile(file, {
  signal: controller.signal,
});
```

**Чтение без ограничений (любой файл):**

```ts
import { readFile } from "@/shared/lib";

const result = await readFile(file);
// result.meta.mime — реальный MIME-тип файла
// result.dataUrl — Data URL для любого типа
```

---

## `readImageFile` — чтение изображений

Надстройка над `readFile` для работы с изображениями. Добавляет:

- Проверку что файл является изображением (`image/*`)
- Типизацию `allowedMime` на `ImageMime` (только image-типы)
- Автоматическое извлечение размеров изображения (`dimensions`) в режиме `data-url`

### Сигнатуры

```ts
// Чтение как Data URL с размерами (по умолчанию)
readImageFile(file: File, opts?: { mode?: "data-url"; ... }): Promise<ReadImageAsDataUrlResult>

// Чтение как ArrayBuffer
readImageFile(file: File, opts: { mode: "array-buffer"; ... }): Promise<ReadImageAsArrayBufferResult>
```

### Опции (`ReadImageOptions`)

| Параметр      | Тип                            | По умолчанию | Описание                           |
| ------------- | ------------------------------ | ------------ | ---------------------------------- |
| `mode`        | `"data-url" \| "array-buffer"` | `"data-url"` | Режим чтения файла                 |
| `allowedMime` | `readonly ImageMime[]`         | —            | Разрешённые image MIME-типы        |
| `maxBytes`    | `number`                       | —            | Максимальный размер файла в байтах |
| `signal`      | `AbortSignal`                  | —            | Сигнал для отмены операции         |

**`ImageMime`** — допустимые значения:
`"image/png"`, `"image/jpeg"`, `"image/webp"`, `"image/gif"`, `"image/svg+xml"`, `"image/avif"`

### Результат

**`ReadImageAsDataUrlResult`** расширяет `ReadFileAsDataUrlResult`:

| Поле         | Тип                | Описание                         |
| ------------ | ------------------ | -------------------------------- |
| `mode`       | `"data-url"`       | Дискриминант режима              |
| `meta`       | `FileMeta`         | Метаданные файла                 |
| `dataUrl`    | `string`           | Содержимое в формате Data URL    |
| `file`       | `File`             | Исходный объект `File`           |
| `dimensions` | `ImageDimensions?` | Ширина и высота изображения (px) |

**`ReadImageAsArrayBufferResult`** — идентичен `ReadFileAsArrayBufferResult`.

### Примеры

**Загрузка фото с ограничениями:**

```ts
import { readImageFile, ReadImageError } from "@/shared/lib";

async function selectPhoto(file: File) {
  try {
    const result = await readImageFile(file, {
      allowedMime: ["image/jpeg", "image/png", "image/webp"],
      maxBytes: 10 * 1024 * 1024, // 10 МБ
    });

    console.log(result.dimensions); // { width: 1920, height: 1080 }
    preview.src = result.dataUrl;
  } catch (error) {
    if (error instanceof ReadImageError) {
      switch (error.code) {
        case "NOT_AN_IMAGE":
          alert("Выберите изображение");
          break;
        case "MIME_NOT_ALLOWED":
          alert("Формат не поддерживается");
          break;
        case "FILE_TOO_LARGE":
          alert("Файл слишком большой");
          break;
      }
    }
  }
}
```

**Чтение изображения как ArrayBuffer:**

```ts
import { readImageFile } from "@/shared/lib";

const result = await readImageFile(file, { mode: "array-buffer" });
// result.buffer: ArrayBuffer
// dimensions не извлекаются в этом режиме
```

---

## Обработка ошибок

### `ReadFileError`

Базовый класс ошибок для `readFile`.

| Код                | Когда возникает                                      |
| ------------------ | ---------------------------------------------------- |
| `NO_FILE`          | Файл не передан                                      |
| `MIME_NOT_ALLOWED` | MIME-тип файла не входит в `allowedMime`             |
| `FILE_TOO_LARGE`   | Размер файла превышает `maxBytes`                    |
| `READ_ABORTED`     | Чтение прервано через `AbortSignal` или `FileReader` |
| `READ_FAILED`      | Ошибка `FileReader` при чтении                       |

### `ReadImageError`

Класс ошибок для `readImageFile`. Наследует все коды из `ReadFileErrorCode` и добавляет:

| Код                   | Когда возникает                                            |
| --------------------- | ---------------------------------------------------------- |
| `NOT_AN_IMAGE`        | MIME-тип файла не начинается с `image/`                    |
| `IMAGE_DECODE_FAILED` | Не удалось декодировать изображение для получения размеров |

### Пример обработки ошибок

```ts
import { readFile, ReadFileError } from "@/shared/lib";

try {
  const result = await readFile(file, { maxBytes: 5 * 1024 * 1024 });
} catch (error) {
  if (error instanceof ReadFileError) {
    // error.code — строковый код ошибки
    // error.message — описание на русском
    // error.cause — оригинальная ошибка (если есть)
    console.error(`[${error.code}] ${error.message}`);
  }
}
```

---

## Утилиты

Экспортируются из `read-file` для переиспользования в надстройках:

| Функция                       | Описание                                                             |
| ----------------------------- | -------------------------------------------------------------------- |
| `buildMeta(file)`             | Извлекает `FileMeta` из объекта `File`                               |
| `assertNotAborted(signal?)`   | Бросает `ReadFileError("READ_ABORTED")` если сигнал отменён          |
| `attachAbort(signal, reader)` | Привязывает `AbortSignal` к `FileReader`, возвращает функцию отписки |
