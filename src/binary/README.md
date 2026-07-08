# `shared/lib/binary`

Модуль содержит небольшие утилиты для работы с бинарным содержимым, которое приходит в приложение строкой. Основной сценарий — получить из SAP/OData/REST-ответа base64-документ, определить его MIME-тип и передать дальше как `Blob` в просмотрщик, ссылку скачивания или API браузера.

Модуль находится в `shared`, поэтому не содержит бизнес-знаний о типах документов конкретного приложения. Например, `detectMimeType` не использует коды вроде `documentType`: MIME определяется только по имени файла, data URL или сигнатуре самих данных.

## Публичный API

```ts
import { binaryToBlob, detectMimeType, useBinaryFile } from "@/shared/lib";
```

Также модуль реэкспортируется через общий `@/shared/lib`.

### `binaryToBlob`

```ts
binaryToBlob(binaryData: string, mimeType?: string, isBase64?: boolean): Blob
```

Преобразует строковое бинарное содержимое в `Blob`.

Параметры:

- `binaryData` — исходные данные. По умолчанию ожидается base64-строка.
- `mimeType` — MIME-тип создаваемого Blob. Если передана пустая строка, используется `application/octet-stream`.
- `isBase64` — признак формата входных данных. По умолчанию `true`. Если передать `false`, строка будет обработана как raw binary string.

Поддерживаются:

- обычный base64;
- base64 с пробелами и переносами строк;
- URL-safe base64 с символами `-` и `_`;
- data URL вида `data:application/pdf;base64,...`.

Функция возвращает именно `Blob`. Object URL нужно создавать отдельно через `URL.createObjectURL(blob)` и освобождать через `URL.revokeObjectURL(url)` на стороне вызывающего кода.

Пример:

```ts
const mime = detectMimeType(fileName, fileContent);
const blob = binaryToBlob(fileContent, mime);
const url = URL.createObjectURL(blob);
```

### `detectMimeType`

```ts
detectMimeType(fileName?: string, binaryData?: string): string
```

Определяет MIME-тип без привязки к бизнес-типу документа.

Порядок определения:

1. По расширению `fileName`.
2. По MIME-типу из data URL.
3. По сигнатуре первых байтов base64-данных.
4. Fallback `application/pdf`.

Поддерживаемые расширения включают распространённые документы и изображения: `pdf`, `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `bmp`, `tif`, `tiff`, `xml`, `txt`, `csv`, `json`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`, `zip`.

По сигнатуре определяются:

- PDF;
- JPEG;
- PNG;
- GIF;
- WEBP;
- ZIP;
- XML-подобные текстовые данные.

Fallback `application/pdf` сохранён намеренно: большинство документов в текущем контуре отображаются как PDF, а неизвестный тип чаще должен открыться в документном просмотрщике, чем стать произвольным `application/octet-stream`.

### `useBinaryFile`

```ts
useBinaryFile(bin: string | undefined): {
	data: { blob: Blob; mime: string } | null;
	error: string | null;
}
```

React-хук для компонентов, которым нужно получить готовую пару `Blob + MIME` из base64-строки.

Поведение:

- при наличии `bin` определяет MIME через `detectMimeType`;
- создаёт `Blob` через `binaryToBlob`;
- пишет ошибку в `error`, если данные некорректны;
- очищает `data` и `error`, когда `bin` становится пустым.

Хук не создаёт object URL и не управляет его жизненным циклом. Это должно оставаться в компоненте, потому что именно компонент знает, когда URL больше не нужен.

## Ограничения

- Модуль рассчитан на браузерное окружение и использует `Blob` и `atob`.
- MIME по сигнатуре определяется только для ограниченного набора популярных форматов.
- Функции не валидируют содержимое файла полностью. Проверяется только формат base64 и несколько первых байтов для MIME-detection.
- Модуль не должен импортировать сущности, фичи, виджеты или приложения. Если нужен бизнес-маппинг кодов документов, его нужно держать в соответствующем доменном слое и передавать результат в этот модуль уже как MIME-строку.

## Проверки

Поведение покрыто тестами в `binaryToBlob.test.ts`.

Релевантный узкий запуск:

```bash
npm run test -- run src/shared/lib/binary/binaryToBlob.test.ts
```
