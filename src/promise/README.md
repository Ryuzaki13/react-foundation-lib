# Управляемое ожидание через Promise

Модуль `@ryuzaki13/react-foundation-lib/promise` создаёт Promise, который можно
завершить из внешнего callback или события. Он подходит для ожидания освобождения
ресурсов, остановки фоновой операции и других технических lifecycle без знания
конкретного приложения.

```ts
import { createDeferredPromise } from "@ryuzaki13/react-foundation-lib/promise";

const completion = createDeferredPromise<void>();

// Владелец операции завершает ожидание после освобождения своих ресурсов.
completion.resolve();
await completion.promise;
```

## Публичный API

```ts
type DeferredPromise<T> = {
	readonly promise: Promise<T>;
	readonly resolve: (value: T | PromiseLike<T>) => void;
	readonly reject: (reason?: unknown) => void;
};

function createDeferredPromise<T>(): DeferredPromise<T>;
```

`promise` остаётся незавершённым до вызова `resolve` или `reject`. `resolve`
принимает значение либо другой Promise/thenable и ожидает его итог. Для
`DeferredPromise<void>` допустим вызов `resolve()` без аргумента. `reject`
сохраняет исходную причину отказа, в том числе значение, отличное от `Error`.

Каждый вызов создаёт независимое ожидание. Нативный Promise сохраняет первое
решение: последующие вызовы `resolve`/`reject` его не меняют. Сам примитив не
добавляет отмену, timeout или обработчик ошибок; владелец операции отвечает за
обязательное завершение ожидания и обработку rejection.

## Совместимость

Реализация использует обычный `new Promise` и не требует API новее ES2022.
Импорт не устанавливает полифиллы и не изменяет глобальный `Promise`.
Модуль не зависит от React, Router, браузерного хранилища или Node.js.
