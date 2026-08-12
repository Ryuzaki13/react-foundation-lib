# Копирование текста через `@ryuzaki13/react-foundation-lib/copy`

Модуль `copy` содержит React hooks для копирования текста в системный буфер обмена, чтения текста из DOM-элемента и показа короткого состояния «скопировано».

Основные сценарии:

- скопировать готовую строку;
- скопировать текст, который сейчас находится внутри элемента;
- на две секунды заменить подпись или иконку кнопки после успешного копирования.

Модуль ориентирован на браузер. Он скрывает технический выбор между современным Clipboard API и legacy fallback, но не отменяет браузерные разрешения и ограничения безопасности.

README рассчитан на разработчика, который использует опубликованный пакет без доступа к исходному коду. Здесь объясняются базовые понятия React и DOM, точное поведение каждого hook, обработка ошибок, доступность, тестирование и известные ограничения.

## Содержание

- [Назначение и границы модуля](#назначение-и-границы-модуля)
- [Установка и импорт](#установка-и-импорт)
- [Минимальные понятия](#минимальные-понятия)
- [Как выбрать API](#как-выбрать-api)
- [Быстрый старт](#быстрый-старт)
- [`useCopyText`](#usecopytext)
- [`useElementText`](#useelementtext)
- [`useCopyElementText`](#usecopyelementtext)
- [`useCopyFeedback`](#usecopyfeedback)
- [`useCopyElementTextWithFeedback`](#usecopyelementtextwithfeedback)
- [Как выбирается способ копирования](#как-выбирается-способ-копирования)
- [Готовые рецепты](#готовые-рецепты)
- [Доступность и UX](#доступность-и-ux)
- [SSR и browser boundary](#ssr-и-browser-boundary)
- [Тестирование](#тестирование)
- [Ограничения и частые ошибки](#ограничения-и-частые-ошибки)
- [Краткий справочник API](#краткий-справочник-api)
- [Вопросы и ответы](#вопросы-и-ответы)

## Назначение и границы модуля

### Что делает `copy`

- копирует непустую строку через `navigator.clipboard.writeText`, когда это возможно;
- использует fallback через временный DOM-элемент и `document.execCommand("copy")`, если современный Clipboard API недоступен или страница не является secure context;
- возвращает `Promise<boolean>`, чтобы вызывающий код узнал об успехе или неудаче;
- читает актуальный `textContent` DOM-элемента через React ref;
- объединяет чтение элемента и копирование;
- предоставляет двухсекундное состояние `isCopied` для UI-feedback.

### Чего модуль не делает

- не читает системный буфер обмена;
- не копирует изображения, файлы, HTML или произвольные MIME-данные;
- не запрашивает разрешение отдельным диалогом и не обходит политику браузера;
- не гарантирует работу вне пользовательского действия;
- не показывает toast, tooltip или иконку самостоятельно;
- не предоставляет React-компонент кнопки;
- не копирует `value` из `<input>` или `<textarea>` через element hooks;
- не сообщает причину ошибки отдельным объектом;
- не повторяет операцию автоматически;
- не синхронизирует feedback между несколькими кнопками.

### Соседние задачи

| Задача                                | Что использовать                                       |
| ------------------------------------- | ------------------------------------------------------ |
| Скопировать текст                     | `@ryuzaki13/react-foundation-lib/copy`                 |
| Скачать готовый `Blob` или JSON-файл  | `@ryuzaki13/react-foundation-lib/dom`                  |
| Прочитать пользовательский файл       | `@ryuzaki13/react-foundation-lib/file`                 |
| Декодировать base64 в `Blob`          | `@ryuzaki13/react-foundation-lib/binary`               |
| Реализовать визуальную кнопку/tooltip | UI-компонент приложения или foundation UI-пакет        |
| Скопировать изображение или rich HTML | Отдельная реализация Clipboard API для нужного формата |

## Установка и импорт

Установите пакет:

```bash
npm install @ryuzaki13/react-foundation-lib
```

Модуль использует React hooks. Приложение должно предоставить совместимые peer-зависимости React:

```bash
npm install react react-dom
```

Текущий контракт пакета требует React `>=19.2.0 <20.0.0`.

Импортируйте API только из опубликованного subpath `/copy`:

```ts
import {
	useCopyElementText,
	useCopyElementTextWithFeedback,
	useCopyFeedback,
	useCopyText,
	useElementText
} from "@ryuzaki13/react-foundation-lib/copy";
```

Корневой импорт пакета не поддерживается:

```ts
// Неправильно.
import { useCopyText } from "@ryuzaki13/react-foundation-lib";

// Правильно.
import { useCopyText } from "@ryuzaki13/react-foundation-lib/copy";
```

Модуль поставляется как ESM и использует browser APIs:

- `navigator.clipboard`;
- `window.isSecureContext`;
- `window.getSelection`;
- `document.createElement`;
- `document.createRange`;
- `document.execCommand`.

## Минимальные понятия

### Буфер обмена

Буфер обмена — системное временное хранилище, которое используется командами Copy и Paste. После успешного вызова пользователь сможет вставить скопированную строку в другое поле или приложение.

### React hook

Hook — функция React, имя которой начинается с `use`. Hook вызывают только:

- на верхнем уровне React-компонента;
- внутри другого custom hook.

Нельзя вызывать hook внутри `if`, цикла, обработчика клика или обычной utility-функции:

```tsx
function CopyButton() {
	// Правильно: hook вызывается при рендере компонента.
	const { copyToClipboard } = useCopyText();

	const handleClick = async () => {
		// Правильно: обработчик вызывает функцию, полученную из hook.
		await copyToClipboard("Текст");
	};

	return (
		<button type="button" onClick={() => void handleClick()}>
			Копировать
		</button>
	);
}
```

### Асинхронный результат и `Promise<boolean>`

Копирование может завершиться не сразу. Поэтому функции возвращают `Promise<boolean>`:

```ts
const success = await copyToClipboard("Текст");
```

- `true` — операция сообщила об успехе;
- `false` — строка была пустой либо браузерный способ копирования не сработал.

Не проверяйте сам `Promise` как boolean:

```ts
// Неправильно: result является Promise, а не итоговым boolean.
const result = copyToClipboard("Текст");
if (result) {
	// Эта ветка не означает успешное копирование.
}

// Правильно.
const success = await copyToClipboard("Текст");
if (success) {
	// Копирование завершилось успешно.
}
```

### React ref

Ref хранит ссылку на реальный DOM-элемент:

```tsx
const ref = useRef<HTMLSpanElement>(null);

return <span ref={ref}>Текст</span>;
```

До монтирования элемента `ref.current` равен `null`. После монтирования React помещает туда `HTMLSpanElement`.

### `textContent`

Element hooks читают свойство `textContent`. Оно объединяет текст самого элемента и всех его потомков:

```html
<span>Заказ <strong>№ 42</strong></span>
```

Результат:

```text
Заказ № 42
```

Это не то же самое, что визуально отрисованный текст:

- CSS не участвует в формировании результата;
- текст скрытого потомка тоже может попасть в результат;
- подписи вложенных кнопок тоже попадают в результат;
- `value` у `<input>` и `<textarea>` не является их `textContent`;
- переносы, созданные только layout/CSS, не добавляются автоматически.

### Secure context

Современный Clipboard API доступен только в безопасном контексте. Обычно это:

- страница по HTTPS;
- `localhost` в режиме разработки;
- среда, которую браузер отдельно признаёт доверенной.

Обычная production-страница по HTTP обычно не является secure context.

### Пользовательское действие

Браузер может разрешать запись в буфер только во время явного действия пользователя: клика, нажатия клавиши или команды меню. Поэтому вызывайте копирование непосредственно из обработчика такого действия.

## Как выбрать API

| Задача                                                  | API                                |
| ------------------------------------------------------- | ---------------------------------- |
| Скопировать уже имеющуюся строку                        | `useCopyText`                      |
| Прочитать `textContent` из собственного ref             | `useElementText`                   |
| Получить готовый ref и скопировать текст элемента       | `useCopyElementText`               |
| Только показать состояние «готово» на две секунды       | `useCopyFeedback`                  |
| Скопировать текст элемента и показать `isCopied`        | `useCopyElementTextWithFeedback`   |
| Скопировать текущее значение `<input>` или `<textarea>` | `useCopyText` с переменной `value` |
| Скопировать строку, которой ещё нет в DOM               | `useCopyText`                      |
| Копировать HTML, изображение или файл                   | Этот модуль не подходит            |

## Быстрый старт

### Копирование готовой строки

```tsx
import { useState } from "react";
import { useCopyText } from "@ryuzaki13/react-foundation-lib/copy";

export function CopyOrderNumber() {
	const { copyToClipboard } = useCopyText();
	const [message, setMessage] = useState("");

	const handleCopy = async () => {
		const success = await copyToClipboard("ORDER-42");
		setMessage(success ? "Номер скопирован" : "Не удалось скопировать");
	};

	return (
		<div>
			<button type="button" onClick={() => void handleCopy()}>
				Копировать номер
			</button>
			<span aria-live="polite">{message}</span>
		</div>
	);
}
```

### Копирование текста элемента с feedback

```tsx
import { useCopyElementTextWithFeedback } from "@ryuzaki13/react-foundation-lib/copy";

export function CopyAddress() {
	const { containerRef, copyElementText, isCopied } = useCopyElementTextWithFeedback<HTMLSpanElement>();

	return (
		<div>
			<span ref={containerRef}>г. Екатеринбург, ул. Ленина, 1</span>
			<button type="button" onClick={() => void copyElementText()}>
				{isCopied ? "Скопировано" : "Копировать адрес"}
			</button>
			<span className="visually-hidden" aria-live="polite">
				{isCopied ? "Адрес скопирован" : ""}
			</span>
		</div>
	);
}
```

Ref установлен только на `<span>` с адресом. Если поставить его на общий `<div>`, в копируемую строку может попасть текст кнопки и live region.

## `useCopyText`

Копирует переданную строку и возвращает результат операции.

### Сигнатура

```ts
declare const useCopyText: () => {
	copyToClipboard: (text: string) => Promise<boolean>;
};
```

### Параметр `text`

`text` — строка, которую нужно поместить в буфер обмена.

```ts
await copyToClipboard("INV-2026-0001");
```

### Возвращаемое значение

Hook возвращает объект с функцией `copyToClipboard`.

Сама функция возвращает:

- `true`, если `navigator.clipboard.writeText` завершился без ошибки;
- результат `document.execCommand("copy")`, если был выбран fallback;
- `false`, если строка пустая, состоит только из whitespace или произошла ошибка.

Функция стабильна между рендерами компонента: она создаётся через `useCallback` без зависимостей.

### Проверка пустой строки

Перед копированием выполняется проверка `text.trim()`:

```ts
await copyToClipboard(""); // false
await copyToClipboard("   "); // false
await copyToClipboard("\n\t"); // false
```

`trim()` используется только для проверки. Непустой исходный текст копируется без обрезки:

```ts
await copyToClipboard("  ABC  \n");
```

В буфер попадёт строка с двумя пробелами в начале, двумя пробелами и переводом строки в конце.

### Обработка ошибок

Hook не выбрасывает ошибку копирования вызывающему коду. Он возвращает `false`.

Если современный `navigator.clipboard.writeText` выбросил ошибку, она дополнительно записывается в консоль:

```text
Failed to copy text: <исходная ошибка>
```

Ошибки legacy fallback поглощаются без записи в консоль.

### Важное правило fallback

Fallback выбирается только заранее, если Clipboard API отсутствует или `window.isSecureContext` равен `false`.

Если современный `writeText` существует, но отклоняет операцию из-за разрешения, iframe policy или отсутствия user activation, повторной попытки через `execCommand` не будет. Итогом станет `false`.

### Пример с полем ввода

Для `<input>` передавайте его `value` напрямую:

```tsx
import { useState } from "react";
import { useCopyText } from "@ryuzaki13/react-foundation-lib/copy";

export function CopyInputValue() {
	const [value, setValue] = useState("Пользовательский текст");
	const { copyToClipboard } = useCopyText();

	return (
		<label>
			Текст
			<input value={value} onChange={(event) => setValue(event.target.value)} />
			<button type="button" onClick={() => void copyToClipboard(value)}>
				Копировать
			</button>
		</label>
	);
}
```

Не используйте для этого `useCopyElementText<HTMLInputElement>`: `textContent` input-элемента не содержит введённое `value`.

## `useElementText`

Возвращает функцию, которая читает актуальный `textContent` переданного DOM ref.

### Сигнатура

```ts
declare const useElementText: <T extends HTMLElement = HTMLElement>(
	ref: RefObject<T | null>
) => {
	getElementText: () => string;
};
```

### Параметр

`ref` — React ref на `HTMLElement` или его конкретный тип.

```tsx
const paragraphRef = useRef<HTMLParagraphElement>(null);
const { getElementText } = useElementText(paragraphRef);
```

Generic `T` помогает TypeScript проверить, к какому элементу прикрепляется ref. Если конкретный тип не важен, используется `HTMLElement`.

### Точное поведение

При каждом вызове `getElementText()` hook:

1. читает текущее `ref.current`;
2. читает `ref.current.textContent`;
3. обрезает whitespace по краям через `trim()`;
4. возвращает пустую строку, если ref ещё не установлен или текста нет.

```tsx
const text = getElementText();
```

Текст не сохраняется во время рендера. Он читается именно в момент вызова, поэтому изменения DOM до клика будут учтены.

### Пример без копирования

```tsx
import { useRef, useState } from "react";
import { useElementText } from "@ryuzaki13/react-foundation-lib/copy";

export function InspectText() {
	const ref = useRef<HTMLDivElement>(null);
	const { getElementText } = useElementText(ref);
	const [result, setResult] = useState("");

	return (
		<div>
			<div ref={ref}>
				Заказ <strong>№ 42</strong>
			</div>
			<button type="button" onClick={() => setResult(getElementText())}>
				Прочитать DOM-текст
			</button>
			<output>{result}</output>
		</div>
	);
}
```

### `textContent` и скрытый текст

Если внутри контейнера есть скрытая подпись, она всё равно может быть прочитана:

```tsx
<span ref={ref}>
	ABC
	<span className="visually-hidden">Служебное пояснение</span>
</span>
```

Результат будет содержать и `ABC`, и «Служебное пояснение». Если копировать нужно строго определённое значение, безопаснее передать эту строку в `useCopyText`.

## `useCopyElementText`

Создаёт ref, читает `textContent` соответствующего элемента и копирует его.

### Сигнатура

```ts
declare const useCopyElementText: <T extends HTMLElement = HTMLElement>() => {
	containerRef: RefObject<T | null>;
	copyElementText: () => Promise<boolean>;
	getElementText: () => string;
};
```

### Возвращаемые поля

| Поле              | Тип                      | Назначение                                     |
| ----------------- | ------------------------ | ---------------------------------------------- |
| `containerRef`    | `RefObject<T \| null>`   | Установить на элемент с копируемым текстом.    |
| `copyElementText` | `() => Promise<boolean>` | Прочитать элемент и скопировать его текст.     |
| `getElementText`  | `() => string`           | Только получить текущий текст без копирования. |

### Алгоритм

`copyElementText()`:

1. вызывает `getElementText()`;
2. получает trimmed `textContent`;
3. возвращает `false`, если результат пустой;
4. иначе передаёт строку в `copyToClipboard` из `useCopyText`;
5. возвращает итоговый boolean.

Поскольку `useElementText` уже применил `trim()`, при копировании из элемента внешний whitespace удаляется. Это отличается от прямого `useCopyText`, который сохраняет внешний whitespace непустой строки.

### Пример с проверкой результата

```tsx
import { useState } from "react";
import { useCopyElementText } from "@ryuzaki13/react-foundation-lib/copy";

export function CopyCustomerName() {
	const { containerRef, copyElementText } = useCopyElementText<HTMLSpanElement>();
	const [status, setStatus] = useState("");

	const handleCopy = async () => {
		const success = await copyElementText();
		setStatus(success ? "Имя скопировано" : "Копирование недоступно");
	};

	return (
		<div>
			<span ref={containerRef}>Анна Иванова</span>
			<button type="button" onClick={() => void handleCopy()}>
				Копировать имя
			</button>
			<span aria-live="polite">{status}</span>
		</div>
	);
}
```

### Где ставить ref

Ставьте `containerRef` на самый узкий элемент, содержащий только нужный текст:

```tsx
// Правильно: кнопка находится вне копируемого элемента.
<div>
	<span ref={containerRef}>{code}</span>
	<button type="button" onClick={() => void copyElementText()}>
		Копировать
	</button>
</div>
```

```tsx
// Рискованно: подпись кнопки тоже является textContent общего div.
<div ref={containerRef}>
	<span>{code}</span>
	<button type="button" onClick={() => void copyElementText()}>
		Копировать
	</button>
</div>
```

## `useCopyFeedback`

Предоставляет boolean-состояние, которое становится `true` и автоматически переключается обратно в `false` через 2000 миллисекунд.

### Сигнатура

```ts
declare const useCopyFeedback: () => {
	isCopied: boolean;
	showFeedback: () => () => void;
};
```

### Точное поведение

- начальное значение `isCopied` — `false`;
- `showFeedback()` сразу запрашивает установку `isCopied = true`;
- затем создаёт timer на 2000 мс;
- timer устанавливает `isCopied = false`;
- `showFeedback()` возвращает cleanup-функцию, отменяющую именно созданный timer.

```tsx
const { isCopied, showFeedback } = useCopyFeedback();

const handleAction = () => {
	showFeedback();
};
```

Hook ничего не копирует. Название `isCopied` описывает типовой UI-сценарий, но вызывающий код сам решает, когда вызывать `showFeedback`.

### Cleanup-функция

Результат `showFeedback()` имеет тип `() => void`:

```ts
const cancelTimer = showFeedback();
cancelTimer();
```

Cleanup только отменяет переход в `false`. Он не сбрасывает `isCopied` сразу. Если вызвать cleanup, пока компонент продолжает жить, состояние может остаться `true` до другого обновления. Поэтому не используйте cleanup как команду «скрыть сообщение».

Текущая реализация hook не сохраняет cleanup автоматически и не отменяет timer при unmount. Это важно для компонентов с очень коротким жизненным циклом.

### Повторные вызовы

Каждый вызов `showFeedback()` создаёт отдельный timer. Timers не заменяют друг друга.

Если вызвать функцию второй раз через одну секунду, timer первого вызова всё равно сможет установить `false` ещё через одну секунду. Поэтому feedback не гарантирует «ровно две секунды после последнего вызова».

Для редких пользовательских кликов это обычно незаметно. Для частых программных вызовов нужен отдельный feedback hook с last-write-wins timer policy.

## `useCopyElementTextWithFeedback`

Объединяет `useCopyElementText` и `useCopyFeedback`.

### Сигнатура

```ts
declare const useCopyElementTextWithFeedback: <T extends HTMLElement = HTMLElement>() => {
	containerRef: RefObject<T | null>;
	copyElementText: () => Promise<boolean>;
	getElementText: () => string;
	isCopied: boolean;
};
```

### Точное поведение

При вызове `copyElementText()`:

1. читается trimmed `textContent` элемента;
2. выполняется попытка копирования;
3. если получен `true`, вызывается `showFeedback()`;
4. `isCopied` становится `true` примерно на две секунды;
5. возвращается тот же boolean-результат копирования.

При `false` feedback не показывается.

### Пример с иконкой и доступной подписью

```tsx
import { useCopyElementTextWithFeedback } from "@ryuzaki13/react-foundation-lib/copy";

export function CopyReference({ value }: { value: string }) {
	const { containerRef, copyElementText, isCopied } = useCopyElementTextWithFeedback<HTMLCodeElement>();

	return (
		<div>
			<code ref={containerRef}>{value}</code>
			<button type="button" onClick={() => void copyElementText()} aria-label={isCopied ? "Скопировано" : "Копировать значение"}>
				{isCopied ? "✓" : "⧉"}
			</button>
			<span className="visually-hidden" aria-live="polite">
				{isCopied ? "Значение скопировано" : ""}
			</span>
		</div>
	);
}
```

Hook наследует ограничения `useCopyFeedback`: timers не объединяются, cleanup не вызывается автоматически при unmount.

## Как выбирается способ копирования

Упрощённый алгоритм `useCopyText`:

```text
text.trim() пустой?
├─ да  → false
└─ нет
   ├─ navigator.clipboard существует И window.isSecureContext === true
   │  ├─ writeText завершился → true
   │  └─ writeText выбросил ошибку → console.error + false
   └─ иначе
      ├─ execCommand("copy") вернул true → true
      └─ вернул false или произошла ошибка → false
```

### Современный путь

Используется:

```ts
await navigator.clipboard.writeText(text);
```

На результат могут влиять:

- HTTPS/secure context;
- user activation;
- разрешение браузера;
- Permissions Policy родительской страницы;
- настройки iframe;
- настройки пользователя или корпоративного браузера.

### Legacy fallback

Fallback:

1. создаёт невидимый `contentEditable` `<div>`;
2. помещает его в `document.body`;
3. записывает строку в `textContent`;
4. выделяет содержимое через `Range` и `Selection`;
5. вызывает `document.execCommand("copy")`;
6. при обычном завершении снимает выделение и удаляет временный элемент.

`document.execCommand` является устаревшим и browser-dependent API. Наличие fallback не означает поддержку любого старого браузера.

Если внутри fallback произойдёт исключение после добавления временного элемента, текущая реализация не использует `finally`. В таком редком случае она вернёт `false`, но не гарантирует очистку временного элемента и selection.

## Готовые рецепты

### Копирование вычисленного значения

```tsx
function CopyCoordinates({ latitude, longitude }: { latitude: number; longitude: number }) {
	const { copyToClipboard } = useCopyText();
	const value = `${latitude}, ${longitude}`;

	return (
		<button type="button" onClick={() => void copyToClipboard(value)}>
			Копировать координаты
		</button>
	);
}
```

### Отдельная обработка ошибки

```tsx
function CopyToken({ token }: { token: string }) {
	const { copyToClipboard } = useCopyText();
	const [error, setError] = useState("");

	const handleCopy = async () => {
		const success = await copyToClipboard(token);
		setError(success ? "" : "Разрешите доступ к буферу обмена или скопируйте значение вручную");
	};

	return (
		<div>
			<button type="button" onClick={() => void handleCopy()}>
				Копировать
			</button>
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}
```

### Клавиатурная команда

```tsx
function CopyOnShortcut({ value }: { value: string }) {
	const { copyToClipboard } = useCopyText();

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
			event.preventDefault();
			void copyToClipboard(value);
		}
	};

	return (
		<div tabIndex={0} onKeyDown={handleKeyDown}>
			Нажмите Ctrl/Cmd+C, чтобы скопировать значение
		</div>
	);
}
```

Не перехватывайте стандартный Ctrl/Cmd+C глобально без явной необходимости: пользователь может копировать выделенный им текст.

### Копирование текста, который меняется в DOM

```tsx
function CopyLiveCounter({ count }: { count: number }) {
	const { containerRef, copyElementText } = useCopyElementText<HTMLOutputElement>();

	return (
		<div>
			<output ref={containerRef}>Обработано: {count}</output>
			<button type="button" onClick={() => void copyElementText()}>
				Копировать текущий результат
			</button>
		</div>
	);
}
```

При клике будет прочитан текст с актуальным `count`, а не значение первого рендера.

## Доступность и UX

### Используйте настоящую кнопку

Для команды копирования предпочтителен `<button type="button">`, а не кликабельный `<div>`. Кнопка уже поддерживает клавиатуру, фокус и семантику действия.

### Не передавайте успех только цветом или иконкой

Текст «Скопировано» понятнее, чем одна смена цвета. Для screen reader добавьте live region:

```tsx
<span aria-live="polite">{isCopied ? "Скопировано" : ""}</span>
```

### Не показывайте успех до завершения `await`

Операция может быть отклонена. Показывайте успешный feedback только после `true`. `useCopyElementTextWithFeedback` делает это автоматически.

### Оставьте ручной способ копирования

Если значение важно, оставьте его видимым и выделяемым. Тогда пользователь сможет скопировать его вручную, даже если browser API заблокирован.

### Осторожно с чувствительными данными

Не копируйте пароль, token или персональные данные без явного действия пользователя. Буфер обмена доступен другим приложениям и может сохраняться менеджером истории clipboard.

## SSR и browser boundary

Hooks можно импортировать в React-код, но фактическое копирование требует browser globals.

Следуйте правилам:

- вызывайте `copyToClipboard` и `copyElementText` только на клиенте;
- связывайте вызов с пользовательским событием после монтирования;
- не вызывайте копирование во время render;
- не вызывайте его в server loader, server action или Node-only utility;
- в тестовой среде предоставляйте DOM и mock Clipboard API.

`getElementText()` безопасно вернёт пустую строку, пока ref равен `null`. Но это не означает, что сам сценарий копирования является server API.

## Тестирование

### Что стоит проверять в consumer-компоненте

- правильная строка передаётся в `navigator.clipboard.writeText`;
- UI показывает успех только после результата `true`;
- при `false` отображается сообщение об ошибке;
- ref установлен на нужный элемент;
- hidden/button text не попадает в копируемое значение;
- feedback исчезает после 2000 мс;
- повторные клики соответствуют ожидаемой UX-policy.

### Mock современного Clipboard API

Пример для Vitest и DOM test environment:

```tsx
import { vi } from "vitest";

const writeText = vi.fn().mockResolvedValue(undefined);

Object.defineProperty(navigator, "clipboard", {
	configurable: true,
	value: { writeText }
});

Object.defineProperty(window, "isSecureContext", {
	configurable: true,
	value: true
});
```

После пользовательского клика:

```ts
expect(writeText).toHaveBeenCalledWith("ORDER-42");
```

### Проверка ошибки

```ts
writeText.mockRejectedValueOnce(new DOMException("Not allowed", "NotAllowedError"));
```

Поскольку hook пишет ошибку в `console.error`, в тесте можно временно установить spy, а после теста обязательно восстановить его.

### Проверка feedback через fake timers

```ts
vi.useFakeTimers();

// После showFeedback() или успешного клика ожидается isCopied === true.
vi.advanceTimersByTime(2000);
// После React update ожидается isCopied === false.

vi.useRealTimers();
```

При работе с React Testing Library изменение времени нужно выполнять внутри `act`.

## Ограничения и частые ошибки

### Вызов вне пользовательского события

```tsx
useEffect(() => {
	void copyToClipboard(value);
}, [copyToClipboard, value]);
```

Браузер может заблокировать такой вызов. Кроме того, неожиданное изменение clipboard при открытии страницы является плохим UX.

### Игнорирование `Promise`

```tsx
// Ошибка: UI сразу говорит об успехе.
copyToClipboard(value);
setMessage("Скопировано");
```

Правильно дождаться результата:

```tsx
const success = await copyToClipboard(value);
setMessage(success ? "Скопировано" : "Не удалось скопировать");
```

### Ref охватывает лишний UI

В `textContent` попадут подписи вложенных элементов. Установите ref только на значение либо используйте `useCopyText(value)`.

### Попытка прочитать `input.value` через `textContent`

Element hooks не читают значение form control. Передавайте controlled state или `inputRef.current?.value` в `useCopyText`.

### Ожидание rich clipboard

Модуль пишет plain text. Форматирование HTML, изображение и файлы не сохраняются.

### Ожидание fallback после отказа Clipboard API

Если `navigator.clipboard.writeText` был выбран и выбросил ошибку, legacy fallback не запускается.

### Несколько быстрых feedback-вызовов

Timers независимы. Более ранний timer может скрыть сообщение раньше, чем через две секунды после последнего клика.

### Слепое доверие `true`

`true` означает, что выбранный browser API сообщил об успехе. Модуль не читает clipboard обратно и не сравнивает содержимое.

## Краткий справочник API

| API                              | Вход                       | Результат                                      | Главное ограничение                                    |
| -------------------------------- | -------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| `useCopyText`                    | Строка в `copyToClipboard` | `Promise<boolean>`                             | Только plain text; зависит от browser policy.          |
| `useElementText`                 | `RefObject<T \| null>`     | Trimmed `textContent` или `""`                 | Не читает `input.value`; учитывает hidden descendants. |
| `useCopyElementText`             | Generic типа элемента      | Ref, getter и async copy                       | Внешний whitespace элемента обрезается.                |
| `useCopyFeedback`                | Вызов `showFeedback()`     | `isCopied = true`, затем `false` через 2000 мс | Timers не объединяются и не очищаются автоматически.   |
| `useCopyElementTextWithFeedback` | Generic типа элемента      | Ref, getter, async copy и `isCopied`           | Наследует ограничения element text и feedback timer.   |

Все hooks должны вызываться по правилам React hooks.

## Вопросы и ответы

### Почему функция возвращает `false` на строке из пробелов?

Потому что перед копированием проверяется `text.trim()`. Whitespace-only строка считается отсутствующим полезным текстом.

### Обрезает ли `useCopyText` пробелы у нормальной строки?

Нет. `trim()` используется только для проверки пустоты. Исходная непустая строка копируется буквально.

### Обрезает ли `useCopyElementText` пробелы?

Да. `useElementText` возвращает `textContent.trim()`, и именно этот результат передаётся на копирование.

### Почему на localhost работает, а на HTTP-стенде нет?

`localhost` обычно считается доверенным контекстом, а обычный HTTP-хост — нет. На стенде может использоваться legacy fallback, который браузер также вправе заблокировать.

### Почему копирование не работает внутри iframe?

Родительская страница или Permissions Policy может запрещать clipboard-write. Проверьте настройки iframe и вызывайте операцию из пользовательского события.

### Можно ли копировать значение input?

Да, но через `useCopyText(inputValue)`, а не через `useCopyElementText`.

### Можно ли использовать hook без feedback?

Да. Используйте `useCopyText` или `useCopyElementText`.

### Можно ли использовать feedback для другой успешной команды?

Технически да: `useCopyFeedback` только переключает boolean. Учитывайте фиксированные 2000 мс и независимые timers.

### Можно ли изменить длительность двух секунд?

Нет. В текущем публичном API длительность не настраивается.

### Почему `showFeedback` возвращает функцию?

Она отменяет созданный timer. Hook не вызывает её автоматически. Отмена timer не устанавливает `isCopied` обратно в `false`.

### Что выбрать: `useCopyElementText` или `useCopyText`?

Если исходная строка уже есть в state, props или переменной, выбирайте `useCopyText`: результат будет предсказуемее. Element hook удобен, когда источником действительно является собранный DOM-текст.
