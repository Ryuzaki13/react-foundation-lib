# Работа с массивами через `@ryuzaki13/react-foundation-lib/array`

Модуль `array` содержит небольшие типизированные функции для типовых операций с массивами:

- группировки элементов;
- построения словаря по полю объекта;
- удаления дубликатов;
- восстановления порядка элементов по списку идентификаторов;
- сравнения массивов;
- перемещения элементов;
- нормализации строковых идентификаторов и объектов.

Функции не зависят от React, браузерного DOM, TanStack или других внешних runtime-библиотек. Их можно использовать в обычном TypeScript/JavaScript-коде, React-компонентах, store, mapper, validator и на границах сохранения или восстановления конфигурации.

README рассчитан на разработчика, который использует опубликованный пакет и не читает его исходный код. Здесь отдельно объясняются базовые понятия JavaScript/TypeScript, точное поведение каждой функции, ограничения и типовые ошибки.

## Содержание

- [Установка и импорт](#установка-и-импорт)
- [Минимальные понятия JavaScript и TypeScript](#минимальные-понятия-javascript-и-typescript)
- [Как выбрать функцию](#как-выбрать-функцию)
- [Быстрый старт](#быстрый-старт)
- [Общие правила модуля](#общие-правила-модуля)
- [Группировка и построение словаря](#группировка-и-построение-словаря)
- [Удаление дубликатов](#удаление-дубликатов)
- [Работа с идентификаторами и `Map`](#работа-с-идентификаторами-и-map)
- [Сравнение массивов](#сравнение-массивов)
- [Перемещение элементов](#перемещение-элементов)
- [Нормализация строк и объектов](#нормализация-строк-и-объектов)
- [Готовые рецепты](#готовые-рецепты)
- [Производительность](#производительность)
- [Ограничения и частые ошибки](#ограничения-и-частые-ошибки)
- [Краткий справочник API](#краткий-справочник-api)
- [Вопросы и ответы](#вопросы-и-ответы)

## Установка и импорт

Установите пакет в приложении:

```bash
npm install @ryuzaki13/react-foundation-lib
```

Импортируйте функции только из точечного entrypoint `/array`:

```ts
import { arrayGroupBy, arrayToMap, arrayUniqueBy, moveArrayItem } from "@ryuzaki13/react-foundation-lib/array";

import type { ReorderAction } from "@ryuzaki13/react-foundation-lib/array";
```

Корневой импорт пакета не поддерживается:

```ts
// Неправильно: у пакета нет корневого export.
import { arrayGroupBy } from "@ryuzaki13/react-foundation-lib";

// Правильно.
import { arrayGroupBy } from "@ryuzaki13/react-foundation-lib/array";
```

Модуль поставляется как ESM. Для его функций не нужно устанавливать дополнительные peer-зависимости.

## Минимальные понятия JavaScript и TypeScript

### Массив, элемент и индекс

Массив — упорядоченный список значений:

```ts
const letters = ["A", "B", "C"];
```

Каждое значение называется элементом. Позиция элемента называется индексом. Индексы начинаются с нуля:

| Значение | Индекс |
| -------- | -----: |
| `"A"`    |      0 |
| `"B"`    |      1 |
| `"C"`    |      2 |

Поэтому перемещение элемента с индекса `0` на индекс `2` означает перемещение `"A"` в конец.

### Объект и ключ объекта

Объект хранит именованные свойства:

```ts
const user = {
	id: "U-1",
	name: "Анна",
	department: "Продажи"
};
```

Вызов `arrayGroupBy(users, "department")` означает: взять у каждого пользователя свойство `department` и использовать его значение как ключ группы.

TypeScript-конструкция `keyof T` запрещает случайно передать имя свойства, которого нет в элементах массива:

```ts
type User = {
	id: string;
	name: string;
};

const users: User[] = [];

arrayToMap(users, "id"); // Корректно.
arrayToMap(users, "department"); // Ошибка TypeScript: такого свойства нет в User.
```

### Ссылка на объект

Объекты и массивы являются ссылочными значениями. Две переменные могут указывать на один объект:

```ts
const first = { id: "A" };
const second = first;

console.log(first === second); // true
```

Два отдельно созданных объекта с одинаковыми полями имеют разные ссылки:

```ts
const first = { id: "A" };
const second = { id: "A" };

console.log(first === second); // false
```

Это важно для `arrayDeduplicate` и `arraysEqual`: они не выполняют глубокое сравнение содержимого объектов.

### Мутация и неизменяемое преобразование

Мутация — изменение уже существующего массива или объекта:

```ts
const source = ["A", "B"];
source.push("C"); // source изменён.
```

Неизменяемое преобразование создаёт новый массив и оставляет исходный без изменений:

```ts
const source = ["A", "B"];
const result = [...source, "C"];

console.log(source); // ["A", "B"]
console.log(result); // ["A", "B", "C"]
```

Почти все функции этого модуля работают неизменяемо. Исключение — `addUnique`, которая специально изменяет переданные `target` и `seen`.

### Поверхностная копия

Поверхностная копия создаёт новый внешний массив или объект, но не копирует вложенные объекты:

```ts
const profile = { city: "Казань" };
const source = [{ id: "A", profile }];
const copy = [...source];

console.log(copy !== source); // true: массив новый.
console.log(copy[0] === source[0]); // true: элемент тот же.
console.log(copy[0].profile === profile); // true: вложенный объект тот же.
```

Функции модуля не выполняют глубокое клонирование.

### Что означают `T`, `readonly T[]`, `Record`, `Map` и `Set`

| Запись             | Простое объяснение                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `T`                | Обобщённый тип элемента. TypeScript подставит фактический тип из переданного массива.                         |
| `readonly T[]`     | Функция обещает не изменять входной массив. Обычный изменяемый массив тоже можно передать.                    |
| `T[]`              | Массив элементов типа `T`.                                                                                    |
| `Record<string,T>` | Обычный JavaScript-объект, в котором строковый ключ ведёт к значению типа `T`.                                |
| `Map<K,V>`         | Коллекция пар «ключ → значение» с методами `get`, `set`, `has`. Ключ может иметь любой тип.                   |
| `Set<T>`           | Коллекция уникальных значений. Метод `has` проверяет, встречалось ли значение, а `add` добавляет его в набор. |
| `undefined`        | Значение отсутствует. Некоторые normalizer-функции возвращают его вместо пустого результата.                  |

`readonly` в типе параметра не замораживает массив во время выполнения. Это ограничение TypeScript внутри функции, а не вызов `Object.freeze`.

## Как выбрать функцию

| Задача                                                               | Функция                        |
| -------------------------------------------------------------------- | ------------------------------ |
| Собрать элементы в объект с массивами групп                          | `arrayGroupBy`                 |
| Получить группы как массив `{ key, items }`                          | `arrayGroupByToArray`          |
| Быстро находить объект по его `id` или другому полю                  | `arrayToMap`                   |
| Оставить первый объект для каждого уникального значения поля         | `arrayUniqueBy`                |
| Удалить повторяющиеся примитивы или повторные ссылки                 | `arrayDeduplicate`             |
| Оставить только разрешённые ID и убрать их повторы                   | `filterAndDeduplicateIds`      |
| Дописать в конец отсутствующие ID                                    | `appendMissingIds`             |
| Получить значения `Map` в заданном порядке ключей                    | `pickExistingMapValues`        |
| Проверить одинаковую длину, порядок и строгую идентичность элементов | `arraysEqual`                  |
| Переместить элемент с одного числового индекса на другой             | `moveArrayItem` или `moveItem` |
| Переместить элемент в начало, конец, на одну позицию вверх или вниз  | `moveArrayItemByIndex`         |
| Обрезать пробелы у строк, удалить пустые строки и дубли              | `normalizeStringArray`         |
| Нормализовать строковое ключевое поле списка объектов                | `normalizeObjects`             |
| Постепенно собрать уникальные строковые ID в уже существующий массив | `addUnique`                    |

## Быстрый старт

Пусть сервер вернул список пользователей:

```ts
type User = {
	id: string;
	name: string;
	department: string;
};

const users: User[] = [
	{ id: "U-1", name: "Анна", department: "Продажи" },
	{ id: "U-2", name: "Иван", department: "ИТ" },
	{ id: "U-3", name: "Ольга", department: "Продажи" }
];
```

Сгруппировать пользователей по подразделению:

```ts
const usersByDepartment = arrayGroupBy(users, "department");

console.log(usersByDepartment["Продажи"]);
// [
//   { id: "U-1", name: "Анна", department: "Продажи" },
//   { id: "U-3", name: "Ольга", department: "Продажи" }
// ]
```

Построить словарь для быстрого поиска по ID:

```ts
const usersById = arrayToMap(users, "id");

console.log(usersById["U-2"]);
// { id: "U-2", name: "Иван", department: "ИТ" }
```

Переместить первого пользователя в конец без изменения `users`:

```ts
const reorderedUsers = moveArrayItem(users, 0, 2);

console.log(reorderedUsers.map((user) => user.id)); // ["U-2", "U-3", "U-1"]
console.log(users.map((user) => user.id)); // ["U-1", "U-2", "U-3"]
```

## Общие правила модуля

### Исходный массив обычно не изменяется

Все функции, кроме `addUnique`, не изменяют переданный массив. Функции, которые возвращают массив, создают новый внешний массив.

```ts
const source = ["A", "B", "C"];
const result = moveArrayItem(source, 0, 2);

console.log(result === source); // false
console.log(source); // ["A", "B", "C"]
```

Даже если перемещение невозможно или не требуется, функции перемещения возвращают копию:

```ts
const source = ["A", "B"];
const result = moveArrayItem(source, 0, 0);

console.log(result); // ["A", "B"]
console.log(result === source); // false
```

### Элементы обычно не клонируются

Новые массивы содержат прежние значения и ссылки. Исключение — `normalizeObjects` в режиме по умолчанию: она поверхностно копирует каждый сохранённый объект.

Если изменить вложенный объект через результат, изменение будет видно через исходный объект:

```ts
const source = [{ id: "A", settings: { visible: true } }];
const result = arrayUniqueBy(source, "id");

result[0].settings.visible = false;

console.log(source[0].settings.visible); // false
```

### Сохраняется первое подходящее значение

Функции удаления дубликатов и построения словаря сохраняют первое вхождение:

```ts
const rows = [
	{ id: "A", value: 1 },
	{ id: "A", value: 2 }
];

console.log(arrayToMap(rows, "id")["A"].value); // 1
console.log(arrayUniqueBy(rows, "id")); // Только первый объект.
```

### Регистр обычно учитывается

`"A"` и `"a"` считаются разными значениями. Модуль не переводит текст в нижний или верхний регистр.

### Ошибки не логируются и не скрываются

Функции ожидают значения, соответствующие TypeScript-сигнатурам. Например, вместо массива нельзя передавать `null`. TypeScript должен обнаружить такую ошибку до запуска программы.

Исключение — функции перемещения: для целых индексов вне границ массива они безопасно возвращают копию без перестановки.

## Группировка и построение словаря

### `arrayGroupBy`

Сигнатура:

```ts
function arrayGroupBy<T>(array: readonly T[], key: keyof T): Record<string, T[]>;
```

Функция группирует элементы по значению выбранного свойства.

Параметры:

| Параметр | Описание                                           |
| -------- | -------------------------------------------------- |
| `array`  | Исходный массив объектов.                          |
| `key`    | Имя свойства, значение которого определяет группу. |

Результат — обычный объект. Каждый его ключ ведёт к массиву элементов соответствующей группы.

```ts
const tasks = [
	{ id: 1, status: "new" },
	{ id: 2, status: "done" },
	{ id: 3, status: "new" }
];

const tasksByStatus = arrayGroupBy(tasks, "status");

console.log(tasksByStatus);
// {
//   new: [
//     { id: 1, status: "new" },
//     { id: 3, status: "new" }
//   ],
//   done: [
//     { id: 2, status: "done" }
//   ]
// }
```

Точное поведение:

- значение `item[key]` преобразуется через `String`;
- элементы внутри каждой группы остаются в исходном порядке;
- одинаковые строковые ключи попадают в одну группу;
- пустой входной массив возвращает `{}`;
- внешний объект и массивы групп новые;
- сами элементы не копируются.

Преобразование через `String` означает, что разные исходные типы могут стать одним ключом:

```ts
const rows = [
	{ value: "строка", group: 1 },
	{ value: "число", group: "1" }
];

const grouped = arrayGroupBy(rows, "group");

console.log(grouped["1"].length); // 2
```

Не используйте для группировки сложный объект:

```ts
const rows = [
	{ id: 1, group: { code: "A" } },
	{ id: 2, group: { code: "B" } }
];

// Оба объекта обычно превратятся в строку "[object Object]".
const grouped = arrayGroupBy(rows, "group");
```

Выбирайте строковое, числовое или boolean-поле с однозначным строковым представлением.

### `arrayGroupByToArray`

Сигнатура:

```ts
function arrayGroupByToArray<T>(
	array: readonly T[],
	key: keyof T
): Array<{
	key: string;
	items: T[];
}>;
```

Функция выполняет ту же группировку, что `arrayGroupBy`, но возвращает массив групп. Такой результат удобен для `.map()` в UI.

```ts
const tasks = [
	{ id: 1, status: "new" },
	{ id: 2, status: "done" },
	{ id: 3, status: "new" }
];

const groups = arrayGroupByToArray(tasks, "status");

console.log(groups);
// [
//   {
//     key: "new",
//     items: [
//       { id: 1, status: "new" },
//       { id: 3, status: "new" }
//     ]
//   },
//   {
//     key: "done",
//     items: [
//       { id: 2, status: "done" }
//     ]
//   }
// ]
```

Пример React-рендера:

```tsx
const groups = arrayGroupByToArray(tasks, "status");

return groups.map((group) => (
	<section key={group.key}>
		<h2>{group.key}</h2>
		<ul>
			{group.items.map((task) => (
				<li key={task.id}>{task.id}</li>
			))}
		</ul>
	</section>
));
```

Важно: порядок элементов внутри каждой группы сохраняется. Порядок самих групп следует правилам перечисления свойств обычного JavaScript-объекта. Строковые ключи вроде `"new"` и `"done"` обычно сохраняют порядок первого появления, но ключи, похожие на неотрицательные целые числа, перечисляются по возрастанию:

```ts
const rows = [{ group: "10" }, { group: "2" }, { group: "A" }];

console.log(arrayGroupByToArray(rows, "group").map((group) => group.key));
// ["2", "10", "A"], а не ["10", "2", "A"].
```

Если порядок групп является бизнес-правилом, сортируйте готовый массив явно или используйте собственную группировку через `Map`.

### `arrayToMap`

Сигнатура:

```ts
function arrayToMap<T>(array: readonly T[], key: keyof T): Record<string, T>;
```

Несмотря на имя, функция возвращает не экземпляр JavaScript `Map`, а обычный объект-словарь.

```ts
const products = [
	{ id: "P-1", name: "Стол" },
	{ id: "P-2", name: "Стул" }
];

const productsById = arrayToMap(products, "id");

console.log(productsById["P-2"]);
// { id: "P-2", name: "Стул" }
```

Повторный ключ не перезаписывает первое значение:

```ts
const rows = [
	{ id: "A", version: 1 },
	{ id: "A", version: 2 }
];

console.log(arrayToMap(rows, "id")["A"].version); // 1
```

Точное поведение:

- ключ преобразуется через `String`;
- сохраняется первый элемент с каждым строковым ключом;
- пустой массив возвращает `{}`;
- результат новый, элементы не копируются;
- поиск выполняется через квадратные скобки: `result[id]`;
- отсутствующий ключ во время выполнения даёт `undefined`, хотя тип результата записан как `Record<string, T>`.

Безопасно проверяйте наличие значения:

```ts
const product = productsById[selectedId];

if (product) {
	console.log(product.name);
}
```

Для произвольных внешних ключей предпочитайте настоящий `Map`, потому что `arrayToMap`, `arrayGroupBy` и `arrayGroupByToArray` строят обычный объект. Значения вроде `"__proto__"`, `"constructor"` и `"toString"` пересекаются со специальными свойствами прототипа объекта и могут привести к неправильному результату или runtime-ошибке.

```ts
// Хороший вход: заранее проверенные технические ID.
const productsById = arrayToMap(products, "id");

// Для произвольного пользовательского ключа безопаснее Map.
const productsByExternalKey = new Map(products.map((product) => [product.externalKey, product]));
```

## Удаление дубликатов

### `arrayUniqueBy`

Сигнатура:

```ts
function arrayUniqueBy<T>(array: readonly T[], key: keyof T): T[];
```

Функция оставляет первый объект для каждого уникального строкового представления выбранного свойства.

```ts
const rows = [
	{ id: "A", value: 1 },
	{ id: "B", value: 2 },
	{ id: "A", value: 3 }
];

const uniqueRows = arrayUniqueBy(rows, "id");

console.log(uniqueRows);
// [
//   { id: "A", value: 1 },
//   { id: "B", value: 2 }
// ]
```

Точное поведение:

- порядок первых вхождений сохраняется;
- исходный массив не изменяется;
- элементы не копируются;
- пустой массив возвращает новый пустой массив;
- ключ сравнивается после `String(item[key])`;
- `"A"` и `"a"` считаются разными;
- число `1` и строка `"1"` считаются одним ключом;
- `null` превращается в `"null"`, а `undefined` — в `"undefined"`.

Функция подходит для объектов, когда уникальность определяется конкретным полем. Для массива примитивов используйте `arrayDeduplicate`.

### `arrayDeduplicate`

Сигнатура:

```ts
function arrayDeduplicate<T>(array: readonly T[]): T[];
```

Функция удаляет повторяющиеся значения и сохраняет первое вхождение.

```ts
const ids = ["A", "B", "A", "C", "B"];

console.log(arrayDeduplicate(ids));
// ["A", "B", "C"]
```

Для примитивов сравниваются сами значения:

```ts
console.log(arrayDeduplicate([1, 2, 1, 3])); // [1, 2, 3]
console.log(arrayDeduplicate([true, false, true])); // [true, false]
console.log(arrayDeduplicate([Number.NaN, Number.NaN])); // [NaN]
```

Для объектов сравниваются ссылки, а не поля:

```ts
const shared = { id: "A" };

console.log(arrayDeduplicate([shared, shared]).length); // 1
console.log(arrayDeduplicate([{ id: "A" }, { id: "A" }]).length); // 2
```

Если нужно удалить дубликаты объектов по `id`, используйте:

```ts
arrayUniqueBy(objects, "id");
```

`arrayDeduplicate` использует правила равенства `Set`:

- одинаковые примитивы считаются дублями;
- `NaN` считается равным `NaN`;
- `0` и `-0` считаются одним значением;
- объекты считаются одинаковыми только при совпадении ссылки.

## Работа с идентификаторами и `Map`

### `filterAndDeduplicateIds`

Сигнатура:

```ts
function filterAndDeduplicateIds<TId extends string>(ids: readonly string[] | undefined, allowedIds: readonly TId[]): TId[];
```

Функция очищает список идентификаторов по разрешённому набору:

1. сохраняет только ID, которые есть в `allowedIds`;
2. удаляет пустую строку `""`;
3. удаляет повторы;
4. сохраняет порядок первого появления в `ids`.

```ts
const savedOrder = ["D", "B", "UNKNOWN", "B", ""];
const allowedIds = ["A", "B", "C", "D"] as const;

const validOrder = filterAndDeduplicateIds(savedOrder, allowedIds);

console.log(validOrder); // ["D", "B"]
```

Если `ids` равен `undefined`, функция возвращает пустой массив:

```ts
console.log(filterAndDeduplicateIds(undefined, ["A", "B"]));
// []
```

Функция не вызывает `trim`:

```ts
console.log(filterAndDeduplicateIds([" A "], ["A"]));
// []
```

Если вход может содержать пробелы, сначала вызовите `normalizeStringArray`:

```ts
const normalizedIds = normalizeStringArray([" A ", "B "]);
const validIds = filterAndDeduplicateIds(normalizedIds, ["A", "B"]);

console.log(validIds); // ["A", "B"]
```

Сравнение чувствительно к регистру. `"a"` не совпадает с `"A"`.

Generic `TId` сохраняет точный union разрешённых значений:

```ts
const allowedIds = ["name", "email", "phone"] as const;
const result = filterAndDeduplicateIds(["email", "unknown"], allowedIds);

// Тип result:
// Array<"name" | "email" | "phone">
```

### `appendMissingIds`

Сигнатура:

```ts
function appendMissingIds<TId extends string>(baseIds: readonly TId[], idsToAppend: readonly TId[]): TId[];
```

Функция создаёт копию `baseIds`, затем добавляет в конец непустые ID из `idsToAppend`, которых ещё нет в результате.

```ts
const result = appendMissingIds(["D", "B"], ["A", "B", "C", "D"]);

console.log(result); // ["D", "B", "A", "C"]
```

Порядок:

- существующий порядок `baseIds` сохраняется;
- новые ID добавляются в порядке `idsToAppend`;
- ID, уже встреченный в `baseIds` или ранее добавленный из `idsToAppend`, повторно не добавляется.

Важно: функция не очищает сам `baseIds`. Уже существующие там пустые строки и дубли сохраняются:

```ts
const result = appendMissingIds(["A", "A", ""], ["A", "B", ""]);

console.log(result); // ["A", "A", "", "B"]
```

Если нужно очистить базовый список, сначала используйте `filterAndDeduplicateIds`:

```ts
const allowedIds = ["A", "B", "C"] as const;
const cleanBase = filterAndDeduplicateIds(savedIds, allowedIds);
const completeOrder = appendMissingIds(cleanBase, allowedIds);
```

### `pickExistingMapValues`

Сигнатура:

```ts
function pickExistingMapValues<TKey, TValue>(keys: readonly TKey[], valuesByKey: ReadonlyMap<TKey, TValue>): TValue[];
```

Функция последовательно проходит по `keys`, берёт значения из `Map` и возвращает их в порядке ключей. Отсутствующие ключи пропускаются.

```ts
const usersById = new Map([
	["A", { id: "A", name: "Анна" }],
	["B", { id: "B", name: "Иван" }],
	["C", { id: "C", name: "Ольга" }]
]);

const users = pickExistingMapValues(["C", "UNKNOWN", "A"], usersById);

console.log(users.map((user) => user.id)); // ["C", "A"]
```

Точное поведение:

- `valuesByKey` не изменяется;
- результат — новый массив;
- порядок задаёт именно `keys`, а не порядок вставки в `Map`;
- повторный ключ даёт повторное значение;
- отсутствующий ключ пропускается;
- значение `undefined` пропускается, даже если такой ключ существует в `Map`;
- `null`, `false`, `0` и пустая строка являются допустимыми значениями и не пропускаются.

```ts
const values = new Map<string, number | undefined>([
	["A", 0],
	["B", undefined],
	["C", 3]
]);

console.log(pickExistingMapValues(["A", "B", "A", "C"], values));
// [0, 0, 3]
```

Для объектных ключей `Map` сравнивает ссылки:

```ts
const key = { id: "A" };
const values = new Map([[key, "значение"]]);

console.log(pickExistingMapValues([key], values)); // ["значение"]
console.log(pickExistingMapValues([{ id: "A" }], values)); // []
```

## Сравнение массивов

### `arraysEqual`

Сигнатура:

```ts
function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean;
```

Функция возвращает `true`, только если:

1. длина массивов одинакова;
2. значения находятся в одинаковом порядке;
3. каждая пара элементов проходит строгое сравнение `!==`.

```ts
console.log(arraysEqual(["A", "B"], ["A", "B"])); // true
console.log(arraysEqual(["A", "B"], ["B", "A"])); // false
console.log(arraysEqual(["A"], ["A", "B"])); // false
```

Объекты сравниваются по ссылке:

```ts
const shared = { id: "A" };

console.log(arraysEqual([shared], [shared])); // true
console.log(arraysEqual([{ id: "A" }], [{ id: "A" }])); // false
```

Функция не подходит для глубокого сравнения объектов:

```ts
const left = [{ id: "A", settings: { visible: true } }];
const right = [{ id: "A", settings: { visible: true } }];

console.log(arraysEqual(left, right)); // false
```

Дополнительные особенности строгого сравнения:

- `0` и `-0` считаются равными;
- `NaN` не считается равным `NaN`;
- пустая позиция разреженного массива и явный `undefined` на той же позиции будут прочитаны как `undefined` и могут считаться равными.

```ts
console.log(arraysEqual([Number.NaN], [Number.NaN])); // false
```

Типовые применения:

- сравнение массивов строковых ID;
- проверка, изменился ли порядок колонок;
- сравнение списков примитивных значений;
- сравнение массивов стабильных ссылок из одного cache snapshot.

## Перемещение элементов

### Индексы и общие гарантии

Модуль предоставляет три функции перемещения:

| Функция                | Как задаётся новое место                          |
| ---------------------- | ------------------------------------------------- |
| `moveItem`             | Числовыми индексами `from` и `to`.                |
| `moveArrayItem`        | Числовыми индексами `fromIndex` и `toIndex`.      |
| `moveArrayItemByIndex` | Исходным `index` и действием `start/end/up/down`. |

Для обычного массива без элементов `undefined`:

- исходный массив не изменяется;
- возвращается новый массив;
- остальные элементы сохраняют относительный порядок;
- целый индекс меньше `0` или не меньше длины считается некорректным;
- одинаковые исходный и целевой индексы дают копию без перестановки.

Передавайте только конечные целые индексы: `0`, `1`, `2` и так далее. Дробные значения, `NaN` и `Infinity` не являются частью поддерживаемого контракта.

### `moveItem`

Сигнатура:

```ts
function moveItem<T>(items: readonly T[], from: number, to: number): T[];
```

```ts
const source = ["A", "B", "C", "D"];

console.log(moveItem(source, 0, 2));
// ["B", "C", "A", "D"]

console.log(moveItem(source, 3, 1));
// ["A", "D", "B", "C"]

console.log(source);
// ["A", "B", "C", "D"]
```

Некорректный индекс не вызывает исключение:

```ts
const source = ["A", "B", "C"];
const result = moveItem(source, -1, 2);

console.log(result); // ["A", "B", "C"]
console.log(result === source); // false
```

### `moveArrayItem`

Сигнатура:

```ts
function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[];
```

Для массивов с определёнными элементами поведение совпадает с `moveItem`. Имя `moveArrayItem` явно сообщает, что функция перемещает элемент массива.

```ts
const columns = ["name", "email", "phone"];
const nextColumns = moveArrayItem(columns, 2, 0);

console.log(nextColumns);
// ["phone", "name", "email"]
```

Пример с React state:

```tsx
const [columnIds, setColumnIds] = useState(["name", "email", "phone"]);

function moveColumn(fromIndex: number, toIndex: number) {
	setColumnIds((currentIds) => moveArrayItem(currentIds, fromIndex, toIndex));
}
```

### `ReorderAction`

Тип:

```ts
type ReorderAction = "start" | "end" | "up" | "down";
```

| Действие  | Результат                                                   |
| --------- | ----------------------------------------------------------- |
| `"start"` | Переместить элемент на индекс `0`.                          |
| `"end"`   | Переместить элемент на последний индекс.                    |
| `"up"`    | Переместить элемент на одну позицию ближе к началу массива. |
| `"down"`  | Переместить элемент на одну позицию ближе к концу массива.  |

Это техническое действие, а не направление на экране. Для вертикального списка `"up"` обычно означает визуально вверх, но для горизонтального списка интерпретация интерфейса остаётся ответственностью приложения.

### `moveArrayItemByIndex`

Сигнатура:

```ts
function moveArrayItemByIndex<T>(items: readonly T[], index: number, action: ReorderAction): T[];
```

```ts
const items = ["A", "B", "C", "D"];

console.log(moveArrayItemByIndex(items, 2, "start"));
// ["C", "A", "B", "D"]

console.log(moveArrayItemByIndex(items, 1, "end"));
// ["A", "C", "D", "B"]

console.log(moveArrayItemByIndex(items, 2, "up"));
// ["A", "C", "B", "D"]

console.log(moveArrayItemByIndex(items, 1, "down"));
// ["A", "C", "B", "D"]
```

Действие на границе возвращает копию без перестановки:

```ts
const items = ["A", "B", "C"];

console.log(moveArrayItemByIndex(items, 0, "up"));
// ["A", "B", "C"]

console.log(moveArrayItemByIndex(items, 2, "down"));
// ["A", "B", "C"]
```

Пример обработчика кнопок:

```ts
function reorderColumn(columnIds: readonly string[], activeIndex: number, action: ReorderAction) {
	return moveArrayItemByIndex(columnIds, activeIndex, action);
}
```

### Ограничение для `undefined`

Функции перемещения предназначены для массивов, в которых каждый индекс содержит определённый элемент. Не используйте их для перемещения фактического значения `undefined` или разреженных массивов:

```ts
const unsupported = ["A", undefined, "C"];
```

Внутренняя проверка извлечённого элемента использует `item === undefined`. Из-за этого `undefined` нельзя отличить от отсутствующего элемента, а результат разных функций в таком сценарии не является надёжным контрактом. Сначала отфильтруйте или замените такие значения.

## Нормализация строк и объектов

Нормализация — преобразование разных вариантов одного логического значения в единый канонический вид.

Например, строки `" A "`, `"A"` и повторная `"A"` после обрезки пробелов представляют один ID `"A"`.

Нормализаторы изменяют представление данных. Поэтому вызывайте их на явно выбранной границе:

- при восстановлении сохранённой конфигурации;
- перед созданием save snapshot;
- при принятии внешнего payload;
- перед сравнением или построением identity, если это предусмотрено контрактом.

Не записывайте нормализованный результат обратно в пользовательский draft во время обычного ввода, если интерфейс должен сохранять введённое значение буквально.

### `normalizeStringArray`

Сигнатура:

```ts
function normalizeStringArray(items: readonly string[] | undefined): string[] | undefined;
```

Функция:

1. применяет `trim()` к каждой строке;
2. удаляет пустые строки после `trim()`;
3. удаляет повторы после `trim()`;
4. сохраняет первое вхождение и его порядок;
5. возвращает `undefined`, если полезных значений не осталось.

```ts
const result = normalizeStringArray([" A ", "", "A", "B ", "   "]);

console.log(result); // ["A", "B"]
```

Пустые варианты:

```ts
console.log(normalizeStringArray(undefined)); // undefined
console.log(normalizeStringArray([])); // undefined
console.log(normalizeStringArray([" ", "\t"])); // undefined
```

Регистр не меняется:

```ts
console.log(normalizeStringArray(["A", "a", " A "]));
// ["A", "a"]
```

Внутренние пробелы не схлопываются:

```ts
console.log(normalizeStringArray(["  Новая   группа  "]));
// ["Новая   группа"]
```

Если вызывающему коду всегда нужен массив:

```ts
const ids = normalizeStringArray(rawIds) ?? [];
```

Если нужно сохранить различие между «значение отсутствует» и «передан пустой массив», не заменяйте `undefined` автоматически — выберите поведение на своей boundary.

### `normalizeObjects`

Сигнатура:

```ts
function normalizeObjects<T, K extends keyof T, O = T>(
	items: readonly T[] | undefined,
	key: K,
	copyist?: ((item: T, normalizedKey: T[K]) => O) | false
): O[] | undefined;
```

Фактическая сигнатура третьего параметра допускает либо callback, либо отдельное значение `false`:

```ts
copyist?: ((item: T, key: T[K]) => O) | false
```

Функция предназначена для объектов со строковым ключевым полем:

```ts
type Item = {
	id: string;
	label: string;
};
```

Она:

1. читает выбранное поле;
2. принимает его только если это строка;
3. применяет `trim()`;
4. удаляет объект с пустым ключом;
5. удаляет повтор по нормализованному ключу;
6. сохраняет первое вхождение;
7. создаёт результат выбранным способом;
8. возвращает `undefined`, если результат пуст.

Числовое, boolean, объектное, `null` или `undefined` значение выбранного поля считается невалидным и удаляется. Несмотря на общий TypeScript generic, на практике `key` должен указывать на строковое поле.

#### Режим по умолчанию: поверхностная копия

```ts
const source = [
	{ id: " A ", label: "Первый" },
	{ id: "", label: "Пустой" },
	{ id: "A", label: "Дубликат" },
	{ id: "B", label: "Второй" }
];

const result = normalizeObjects(source, "id");

console.log(result);
// [
//   { id: " A ", label: "Первый" },
//   { id: "B", label: "Второй" }
// ]
```

Обратите внимание: нормализованный ключ используется для проверки пустоты и дубликатов, но в стандартной поверхностной копии исходное поле не перезаписывается. Поэтому первый объект сохранил `id: " A "`.

```ts
console.log(result?.[0] !== source[0]); // true
```

Вложенные объекты остаются общими:

```ts
const settings = { visible: true };
const source = [{ id: "A", settings }];
const result = normalizeObjects(source, "id");

console.log(result?.[0].settings === settings); // true
```

#### Callback: построение канонического результата

Callback получает исходный объект и нормализованный ключ. Используйте его, если нужно записать нормализованное значение в результат или изменить форму объекта:

```ts
const source = [
	{ id: " A ", value: 1 },
	{ id: "A", value: 2 },
	{ id: " B ", value: 3 }
];

const result = normalizeObjects(source, "id", (item, normalizedId) => ({
	id: normalizedId,
	label: String(item.value)
}));

console.log(result);
// [
//   { id: "A", label: "1" },
//   { id: "B", label: "3" }
// ]
```

TypeScript выводит тип возвращаемых объектов из callback:

```ts
// Тип result:
// Array<{ id: string; label: string }> | undefined
```

#### `copyist = false`: сохранить исходные ссылки

Если третьим аргументом передать `false`, функция не копирует сохранённые объекты:

```ts
const source = [{ id: "A", value: 1 }];
const result = normalizeObjects(source, "id", false);

console.log(result?.[0] === source[0]); // true
console.log(result === source); // false: внешний массив всё равно новый.
```

Используйте этот режим только когда общие ссылки являются ожидаемым поведением.

#### Пустой результат

```ts
console.log(normalizeObjects(undefined, "id")); // undefined
console.log(normalizeObjects([], "id")); // undefined
console.log(normalizeObjects([{ id: " " }], "id")); // undefined
```

#### Частые ошибки с `normalizeObjects`

Неверно ожидать, что стандартный режим перезапишет ключ:

```ts
const result = normalizeObjects([{ id: " A " }], "id");

console.log(result?.[0].id); // " A ", а не "A".
```

Для канонического ключа нужен callback:

```ts
const result = normalizeObjects([{ id: " A " }], "id", (item, normalizedId) => ({
	...item,
	id: normalizedId
}));

console.log(result?.[0].id); // "A"
```

Неверно выбирать числовое поле:

```ts
const source = [{ id: 1, label: "Первый" }];
const result = normalizeObjects(source, "id");

console.log(result); // undefined
```

Если уникальность должна определяться числом без строковой нормализации, используйте другую функцию или явный mapper, соответствующий вашему контракту.

### `addUnique`

Сигнатура:

```ts
function addUnique(target: string[], seen: Set<string>, fieldId: string | undefined): void;
```

Это единственная намеренно мутирующая функция модуля. Она:

1. применяет `trim()` к `fieldId`;
2. ничего не делает для `undefined` или пустой строки;
3. проверяет нормализованный ID в `seen`;
4. добавляет новый ID одновременно в `seen` и в конец `target`;
5. возвращает `void`.

```ts
const target: string[] = [];
const seen = new Set<string>();

addUnique(target, seen, " A ");
addUnique(target, seen, "A");
addUnique(target, seen, " ");
addUnique(target, seen, "B");

console.log(target); // ["A", "B"]
console.log([...seen]); // ["A", "B"]
```

`seen` является источником истины для проверки дублей. Передавайте один и тот же `Set` на протяжении всей операции:

```ts
const target: string[] = [];
const seen = new Set<string>();

for (const field of fields) {
	addUnique(target, seen, field.id);
}
```

Если `target` уже заполнен, сначала синхронизируйте `seen`:

```ts
const target = normalizeStringArray(existingIds) ?? [];
const seen = new Set(target);

for (const id of additionalIds) {
	addUnique(target, seen, id);
}
```

Не создавайте новый `Set` при каждом вызове:

```ts
// Неправильно: каждый вызов забывает ранее добавленные значения.
addUnique(target, new Set(), "A");
addUnique(target, new Set(), "A");
```

Для нормализации уже готового массива проще использовать `normalizeStringArray`.

## Готовые рецепты

### Восстановить сохранённый порядок и дописать новые элементы

Сценарий:

- в сохранённой конфигурации есть порядок ID;
- часть ID устарела;
- появились новые доступные элементы;
- на выходе нужны существующие элементы в восстановленном порядке.

```ts
type Column = {
	id: string;
	label: string;
};

const columns: Column[] = [
	{ id: "name", label: "Имя" },
	{ id: "email", label: "E-mail" },
	{ id: "phone", label: "Телефон" }
];

const savedOrder = [" phone ", "removed", "name", "name"];

const availableIds = columns.map((column) => column.id);

const normalizedSavedOrder = normalizeStringArray(savedOrder);

const validSavedOrder = filterAndDeduplicateIds(normalizedSavedOrder, availableIds);

const completeOrder = appendMissingIds(validSavedOrder, availableIds);

const columnsById = new Map(columns.map((column) => [column.id, column]));

const orderedColumns = pickExistingMapValues(completeOrder, columnsById);

console.log(completeOrder);
// ["phone", "name", "email"]

console.log(orderedColumns.map((column) => column.label));
// ["Телефон", "Имя", "E-mail"]
```

Каждый шаг имеет отдельную ответственность:

1. `normalizeStringArray` обрезает пробелы и удаляет пустые значения;
2. `filterAndDeduplicateIds` удаляет неизвестные ID;
3. `appendMissingIds` добавляет новые ID;
4. `pickExistingMapValues` восстанавливает объекты в нужном порядке.

### Сгруппировать данные для UI

```ts
const groups = arrayGroupByToArray(employees, "department");

const viewModel = groups.map((group) => ({
	department: group.key,
	count: group.items.length,
	employees: group.items
}));
```

Если нужен обязательный порядок подразделений:

```ts
const departmentOrder = ["Руководство", "Продажи", "ИТ"];

const orderByDepartment = new Map(departmentOrder.map((name, index) => [name, index]));

const groups = arrayGroupByToArray(employees, "department").sort((left, right) => {
	return (orderByDepartment.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (orderByDepartment.get(right.key) ?? Number.MAX_SAFE_INTEGER);
});
```

### Построить словарь и сохранить первое значение

```ts
const metadataByFieldId = arrayToMap(metadataColumns, "fieldId");

const selectedMetadata = metadataByFieldId[selectedFieldId];

if (!selectedMetadata) {
	throw new Error(`Не найдена metadata для поля ${selectedFieldId}`);
}
```

### Удалить дубли объектов по ID

```ts
const uniqueUsers = arrayUniqueBy(users, "id");
```

Не заменяйте это на `arrayDeduplicate(users)`, если одинаковые пользователи представлены разными объектами.

### Переместить элемент по команде интерфейса

```ts
type MoveCommand = {
	activeIndex: number;
	action: ReorderAction;
};

function applyMove(currentIds: readonly string[], command: MoveCommand) {
	return moveArrayItemByIndex(currentIds, command.activeIndex, command.action);
}
```

### Подготовить канонический save snapshot

```ts
type DraftItem = {
	id: string;
	label: string;
};

function createSaveSnapshot(draftItems: readonly DraftItem[]) {
	return (
		normalizeObjects(draftItems, "id", (item, normalizedId) => ({
			...item,
			id: normalizedId,
			label: item.label.trim()
		})) ?? []
	);
}
```

Такой normalizer следует вызывать на границе сохранения. Обычный setter draft должен хранить пользовательский ввод буквально, если контракт приложения не говорит обратного.

## Производительность

Обозначение `n` — количество элементов входного массива.

| Функция                   | Типичная сложность по времени | Дополнительная память                                     |
| ------------------------- | ----------------------------- | --------------------------------------------------------- |
| `arrayGroupBy`            | `O(n)`                        | Объект групп и новые массивы групп.                       |
| `arrayGroupByToArray`     | `O(n)`                        | Объект групп, массив групп и массивы элементов.           |
| `arrayToMap`              | `O(n)`                        | Объект-словарь.                                           |
| `arrayUniqueBy`           | `O(n)`                        | Новый массив и `Set` строковых ключей.                    |
| `arrayDeduplicate`        | `O(n)`                        | Новый массив и `Set` значений.                            |
| `filterAndDeduplicateIds` | `O(n + m)`                    | `Map` разрешённых ID, `Set` и результат.                  |
| `appendMissingIds`        | `O(n + m)`                    | Копия массива и `Set`.                                    |
| `pickExistingMapValues`   | `O(n)` в среднем              | Новый массив.                                             |
| `arraysEqual`             | `O(n)` в худшем случае        | Постоянная память; может завершиться на первом различии.  |
| Функции перемещения       | `O(n)`                        | Копия массива.                                            |
| `normalizeStringArray`    | `O(n)`                        | Новый массив и `Set`.                                     |
| `normalizeObjects`        | `O(n)`                        | Новый массив, `Set`, обычно поверхностные копии объектов. |
| `addUnique`               | `O(1)` в среднем за вызов     | Новое значение в переданных `Set` и массиве.              |

`m` — количество элементов второго массива (`allowedIds` или `idsToAppend`).

Для обычных UI-списков стоимость функций обычно несущественна. Для очень больших массивов не вызывайте одно и то же преобразование многократно внутри цикла или каждого render без необходимости.

В React вычисление можно мемоизировать, если входные ссылки стабильны и преобразование действительно заметно:

```tsx
const usersById = useMemo(() => arrayToMap(users, "id"), [users]);
```

Не добавляйте `useMemo` автоматически для маленьких массивов: сама мемоизация тоже усложняет код и имеет стоимость.

## Ограничения и частые ошибки

### Неправильный entrypoint

```ts
// Неправильно.
import { arraysEqual } from "@ryuzaki13/react-foundation-lib";

// Правильно.
import { arraysEqual } from "@ryuzaki13/react-foundation-lib/array";
```

### Ожидание глубокого клонирования

Функции работают с внешним массивом и ссылками. Они не создают независимую копию всего дерева данных.

Для сериализуемой конфигурации, которой действительно нужна глубокая копия, используйте профильную clone-утилиту из `@ryuzaki13/react-foundation-lib/utils` в соответствии с её контрактом.

### Ожидание глубокого сравнения

```ts
arraysEqual([{ id: "A" }], [{ id: "A" }]); // false
```

Сначала сформируйте сравниваемую identity:

```ts
arraysEqual(
	left.map((item) => item.id),
	right.map((item) => item.id)
);
```

### Потеря различия между `undefined` и `[]`

`normalizeStringArray` и `normalizeObjects` могут вернуть `undefined`. Это часть их контракта.

```ts
const normalized = normalizeStringArray(raw);

if (normalized === undefined) {
	// Полезных значений нет.
}
```

Используйте `?? []` только если ваш вызывающий контракт действительно требует массив.

### Ожидание автоматического `trim`

`filterAndDeduplicateIds`, `appendMissingIds`, `arrayUniqueBy`, `arrayGroupBy` и `arrayToMap` не обрезают строки.

```ts
arrayUniqueBy([{ id: "A" }, { id: " A " }], "id"); // Останутся два объекта.
```

Если пробелы нужно игнорировать, нормализуйте значение на явно выбранной boundary.

### Использование произвольного значения как ключа обычного объекта

`arrayGroupBy`, `arrayGroupByToArray` и `arrayToMap` используют `Record`, а не `Map`.

Не передавайте в них непроверенные ключи, которые могут быть равны `"__proto__"`, `"constructor"` или `"toString"`. Для произвольных внешних значений используйте `Map`.

### Ожидание порядка групп для числовых строк

Группа `"2"` может оказаться раньше группы `"10"` независимо от первого появления. Если порядок важен, сортируйте результат `arrayGroupByToArray` явно.

### Передача `undefined` как перемещаемого элемента

Функции перемещения предназначены для плотных массивов определённых значений. Предварительно очистите массив:

```ts
const definedItems = items.filter((item): item is Item => item !== undefined);
```

### Использование `addUnique` как pure function

`addUnique` меняет аргументы и возвращает `void`:

```ts
const result = addUnique(target, seen, id);

console.log(result); // undefined
```

Проверяйте изменившийся `target`, а не return value.

### Несинхронизированные `target` и `seen`

```ts
const target = ["A"];
const seen = new Set<string>();

addUnique(target, seen, "A");

console.log(target); // ["A", "A"]
```

Правильно:

```ts
const target = ["A"];
const seen = new Set(target);
```

### Нормализация draft во время ввода

`normalizeStringArray` и `normalizeObjects` меняют пользовательское представление: обрезают ключи, удаляют пустые значения и дубли. Не применяйте их внутри обычного store setter, если draft должен сохранять ввод буквально.

Например, строка `"Новая группа "` должна оставаться с завершающим пробелом до явно определённой границы сохранения или восстановления.

## Краткий справочник API

Все значения импортируются из:

```ts
import {
	addUnique,
	appendMissingIds,
	arrayDeduplicate,
	arrayGroupBy,
	arrayGroupByToArray,
	arrayToMap,
	arrayUniqueBy,
	arraysEqual,
	filterAndDeduplicateIds,
	moveArrayItem,
	moveArrayItemByIndex,
	moveItem,
	normalizeObjects,
	normalizeStringArray,
	pickExistingMapValues,
	type ReorderAction
} from "@ryuzaki13/react-foundation-lib/array";
```

| API                       | Вход                                             | Результат                               | Изменяет аргументы |
| ------------------------- | ------------------------------------------------ | --------------------------------------- | ------------------ |
| `arrayGroupBy`            | Массив объектов, имя поля                        | `Record<string, T[]>`                   | Нет                |
| `arrayGroupByToArray`     | Массив объектов, имя поля                        | `Array<{ key: string; items: T[] }>`    | Нет                |
| `arrayToMap`              | Массив объектов, имя поля                        | `Record<string, T>`                     | Нет                |
| `arrayUniqueBy`           | Массив объектов, имя поля                        | `T[]` без повторных строковых ключей    | Нет                |
| `arrayDeduplicate`        | Массив значений                                  | `T[]` без повторных значений или ссылок | Нет                |
| `filterAndDeduplicateIds` | ID или `undefined`, разрешённые ID               | Валидные уникальные ID                  | Нет                |
| `appendMissingIds`        | Базовые ID, добавляемые ID                       | Копия с отсутствующими ID в конце       | Нет                |
| `pickExistingMapValues`   | Порядок ключей, `ReadonlyMap`                    | Найденные значения в порядке ключей     | Нет                |
| `arraysEqual`             | Два массива                                      | `boolean`                               | Нет                |
| `moveItem`                | Массив, `from`, `to`                             | Переставленная копия                    | Нет                |
| `moveArrayItem`           | Массив, `fromIndex`, `toIndex`                   | Переставленная копия                    | Нет                |
| `moveArrayItemByIndex`    | Массив, `index`, `ReorderAction`                 | Переставленная копия                    | Нет                |
| `normalizeStringArray`    | Строки или `undefined`                           | Нормализованные строки или `undefined`  | Нет                |
| `normalizeObjects`        | Объекты, строковое поле, callback или `false`    | Нормализованные объекты или `undefined` | Нет                |
| `addUnique`               | Изменяемый массив, `Set`, строка или `undefined` | `void`                                  | Да                 |
| `ReorderAction`           | TypeScript type                                  | `"start" \| "end" \| "up" \| "down"`    | Не применимо       |

## Вопросы и ответы

### Почему функции принимают `readonly T[]`, но возвращают `T[]`?

`readonly` запрещает функции изменять входной массив. Результат создаётся заново и может быть изменяемым. Это позволяет безопасно передавать как обычные массивы, так и readonly-массивы.

### Почему `arrayToMap` называется `Map`, но возвращает объект?

Имя описывает идею сопоставления ключа и значения. Фактический тип результата — `Record<string, T>`, поэтому доступ выполняется как `result[id]`, а не `result.get(id)`.

Если нужен ключ не строкового типа, гарантированное сохранение порядка вставки или безопасная работа с произвольными внешними ключами, используйте встроенный `Map`.

### Почему `arraysEqual` возвращает `false` для одинаково выглядящих объектов?

Потому что функция использует строгое сравнение элементов. Отдельно созданные объекты имеют разные ссылки. Сравните стабильные ID или используйте предметный comparator.

### Почему `arrayDeduplicate` не удалил одинаковые объекты?

Она удаляет повторные ссылки, а не объекты с одинаковыми полями. Для уникальности по полю используйте `arrayUniqueBy`.

### Почему `normalizeObjects` не записал обрезанный ключ в объект?

В режиме по умолчанию нормализованный ключ используется только для проверки пустоты и дублей. Результат содержит поверхностную копию исходного объекта. Передайте callback и явно запишите `normalizedKey`.

### Почему normalizer возвращает `undefined`, а не `[]`?

Так контракт позволяет обозначить отсутствие полезной конфигурации. Если вашему коду нужен пустой массив, используйте `normalizeStringArray(value) ?? []` или `normalizeObjects(value, "id") ?? []`.

### Можно ли использовать функции в React state?

Да. Функции перемещения и большинство преобразований возвращают новый массив, поэтому подходят для функционального обновления state:

```tsx
setItems((currentItems) => moveArrayItem(currentItems, fromIndex, toIndex));
```

`addUnique` мутирует аргументы, поэтому не вызывайте её напрямую над текущим state-массивом. Сначала создайте копию или соберите новый результат вне state.

### Меняют ли функции вложенные объекты?

Нет, но обычно сохраняют ссылки на них. Если вызывающий код затем мутирует вложенный объект через результат, это изменение будет видно и через исходные данные.

### Считаются ли `"A"` и `"a"` дублями?

Нет. Сравнение строк чувствительно к регистру. Если регистр не должен иметь значения, создайте отдельное нормализованное identity в своём предметном контракте.

### Нужно ли оборачивать каждый вызов в `try/catch`?

Нет, если аргументы соответствуют TypeScript-сигнатуре. Эти функции не используют сеть и не выполняют асинхронные операции. Ошибка обычно означает нарушение контракта входных данных, которое нужно исправить или валидировать на внешней boundary.
