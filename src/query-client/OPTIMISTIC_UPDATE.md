# Оптимистичное обновление кеша (Optimistic Update)

## Содержание

- [Что такое оптимистичное обновление](#что-такое-оптимистичное-обновление)
- [Какие проблемы оно решает](#какие-проблемы-оно-решает)
- [Жизненный цикл мутации и роль каждого хэндлера](#жизненный-цикл-мутации-и-роль-каждого-хэндлера)
- [Проблема гонки (Race Condition)](#проблема-гонки-race-condition)
- [Текущая реализация](#текущая-реализация)
- [Публичный API](#публичный-api)
- [Сценарий 1 — Сервер возвращает `void`](#сценарий-1--сервер-возвращает-void)
- [Сценарий 2 — Сервер возвращает авторитетный объект](#сценарий-2--сервер-возвращает-авторитетный-объект)
- [Сценарий 3 — Инвалидация нескольких ключей с рефетчем](#сценарий-3--инвалидация-нескольких-ключей-с-рефетчем)
- [Стратегии `onSettled`](#стратегии-onsettled)
- [Интеграция с мультивкладочным broadcast](#интеграция-с-мультивкладочным-broadcast)
- [Типовые ошибки](#типовые-ошибки)

---

## Что такое оптимистичное обновление

Стандартный цикл мутации выглядит так:

```
Пользователь нажал → запрос ушёл на сервер → ответ пришёл → UI обновился
```

Между кликом и обновлением UI — задержка сети (100–2000 мс). Пользователь видит «зависший» интерфейс.

**Оптимистичное обновление** (optimistic update) переворачивает этот порядок:

```
Пользователь нажал → UI обновился мгновенно → запрос ушёл на сервер
                                                    ↓
                                      Успех: данные подтверждены
                                      Ошибка: UI откатывается к предыдущему состоянию
```

Мы «оптимистично» предполагаем, что сервер согласится с нашим изменением, и сразу показываем результат пользователю. Если сервер всё-таки отказал — откатываемся к снапшоту.

---

## Какие проблемы оно решает

| Проблема                   | Без оптимистики                               | С оптимистикой                                  |
| -------------------------- | --------------------------------------------- | ----------------------------------------------- |
| **Отзывчивость UI**        | Пользователь ждёт ответа сети                 | Изменение отражается мгновенно                  |
| **Ощущение быстроты**      | Интерфейс кажется «тяжёлым»                   | Интерфейс работает как нативное приложение      |
| **Ошибки сети**            | Пользователь не понимает, применилось ли      | Явный откат + уведомление                       |
| **Гонка запросов**         | Фоновый refetch может «съесть» новое значение | `cancelQueries` блокирует конкурирующие запросы |
| **Параллельные изменения** | Сложно управлять несколькими изменениями      | Снапшот изолирует каждое изменение              |

Особенно актуально для:

- переключателей видимости / состояния (toggle)
- inline-редактирования в таблицах
- drag-and-drop сортировки
- лайков, голосований, избранного

---

## Жизненный цикл мутации и роль каждого хэндлера

```
useMutation.mutate(variables)
        │
        ▼
   onMutate(variables)           ← вызывается ДО запроса
   ┌──────────────────────────────────────────────────────┐
   │ 1. cancelQueries — отменяем конкурирующие запросы    │
   │ 2. getQueryData  — берём снапшот текущего кеша       │
   │ 3. setQueryData  — применяем оптимистичный патч      │
   │ → возвращает OptimisticContext { previous }          │
   └──────────────────────────────────────────────────────┘
        │
        ▼
   mutationFn(variables)         ← HTTP-запрос на сервер
        │
        ├─ Успех ──► onSuccess(data, variables, context)
        │             ├── Если сервер вернул данные: onSuccessOptimistic()
        │             └── Если сервер вернул void: кеш уже актуален, ничего не делаем
        │
        ├─ Ошибка ──► onError(error, variables, context)
        │              └── onErrorOptimistic() — восстанавливаем context.previous
        │
        └─ Любой исход ──► onSettled(data?, error?, variables, context)
                            └── onSettledOptimistic() — инвалидируем ключи
```

`context` — это то, что вернул `onMutate`. TanStack Query автоматически передаёт его в `onError`, `onSuccess` и `onSettled` как третий / четвёртый аргумент.

---

## Проблема гонки (Race Condition)

Представьте: в кеше есть активная подписка, которая периодически рефетчит данные. Пользователь меняет значение:

1. `onMutate` применяет оптимистичный патч → в кеше `visible: true`
2. Параллельный фоновый рефетч завершается → в кеше снова `visible: false` (старые данные с сервера)
3. Пользователь видит, что его изменение «пропало»

**Решение**: в `onMutate` сначала вызываем `cancelQueries` — это отменяет все активные запросы по ключу. Следующий рефетч произойдёт только после `onSettled`.

```
cancelQueries → setQueryData(оптимистик) → ... HTTP ... → invalidateQueries(stale) → рефетч при следующем монтировании
```

---

## Текущая реализация

Модуль реализован в [queryClient.ts](./queryClient.ts) и экспортируется через [`index.ts`](./index.ts).

### Ключевые типы

```ts
// Снапшот кеша — единственное связующее звено между onMutate и onError/onSuccess/onSettled
type OptimisticContext<TQueryCacheData> = {
	previous: TQueryCacheData | undefined;
};

// Настройки стратегии инвалидации в onSettled
type OnSettledOptimisticOptions = {
	refetchType?: "none" | "active" | "inactive" | "all";
};
```

### Дженерики и типобезопасность

- `TQueryCacheData` — тип данных, хранящихся в кеше (например, `SettingsTileData`)
- `TServerData` — тип ответа сервера (может отличаться от `TQueryCacheData`)
- Функция `merger` в `onSuccessOptimistic` — типизированный мост между `TServerData` и `TQueryCacheData`

Нет ни одного `any` в публичном API. Все связи выведены через дженерики.

---

## Публичный API

```ts
import {
	onMutateOptimistic, // onMutate handler
	onErrorOptimistic, // onError handler
	onSuccessOptimistic, // onSuccess handler (когда сервер вернул данные)
	onSettledOptimistic, // onSettled handler
	OptimisticContext, // тип контекста
	OnSettledOptimisticOptions // тип параметров onSettled
} from "@/shared/lib";
```

| Функция               | Хэндлер     | Обязателен    | Описание                        |
| --------------------- | ----------- | ------------- | ------------------------------- |
| `onMutateOptimistic`  | `onMutate`  | Да            | Снапшот + оптимистичный патч    |
| `onErrorOptimistic`   | `onError`   | Да            | Откат к снапшоту                |
| `onSuccessOptimistic` | `onSuccess` | Нет           | Применение ответа сервера в кеш |
| `onSettledOptimistic` | `onSettled` | Рекомендуется | Инвалидация ключей              |

---

## Сценарий 1 — Сервер возвращает `void`

**Ситуация**: PUT/PATCH-запрос, сервер подтверждает операцию пустым ответом `204 No Content`.  
После успеха оставляем оптимистичное состояние — оно уже верно.

Реальный пример из проекта: [`useTileMutation.ts`](/src/app/api/tiles/useTileMutation.ts)

```ts
// Патч-функция: иммутабельно обновляет только нужный элемент в структуре
function patchTiles(old: SettingsTileData | undefined, newTile: SettingTileData): SettingsTileData | undefined {
	if (!old) return old;
	return old.map((group) => ({
		...group,
		items: group.items.map((t) => (t.id === newTile.id ? { ...t, visible: newTile.visible } : t))
	}));
}

export const useTileMutation = () => {
	const queryClient = useQueryClient();
	const notify = useNotify();

	return useMutation({
		mutationFn: (tile: SettingTileData) =>
			fetchJsonMutationFn<void, RawSettingTileMutationData>(
				`/${SERVICE}/ScanTileSet(ID_SCAN='${tile.scanId}',ID='${tile.id}')`,
				"PUT",
				"odata"
			)(transformSettingTileDataToMutation(tile)),

		// Вызывается ДО запроса: патчим кеш и возвращаем снапшот
		onMutate: async (newTile) => onMutateOptimistic<SettingsTileData>(queryClient, tilesQueryKeys, (old) => patchTiles(old, newTile)),

		// Сервер ответил ошибкой — откатываемся к снапшоту
		onError: (error, _, context) => {
			onErrorOptimistic(queryClient, tilesQueryKeys, context);
			notify.error("Данные не были сохранены");
			console.error(error);
		},

		// Сервер вернул void — кеш уже актуален, onSuccessOptimistic не нужен.
		// Только уведомление + broadcast в другие вкладки.
		onSuccess: (_, variables) => {
			const nextData = queryClient.getQueryData<SettingsTileData>(tilesQueryKeys);
			if (nextData) {
				broadcastCacheEvent({ type: "setQueryData", key: tilesQueryKeys, data: nextData });
			}
			notify.success(`Видимость '${variables.text}' изменена`);
		},

		// Помечаем кеш устаревшим (без немедленного рефетча) и оповещаем другие вкладки
		onSettled: async () => {
			await onSettledOptimistic(queryClient, tilesQueryKeys);
			broadcastCacheEvent({ type: "invalidate", keys: [tilesQueryKeys], refetchType: "none" });
		}
	});
};
```

**Что происходит с кешем**:

```
До клика:        [{ id: 1, visible: false }, { id: 2, visible: true }]
После onMutate:  [{ id: 1, visible: true  }, { id: 2, visible: true }]  ← оптимистик
После onSettled: кеш помечен stale, рефетч произойдёт при следующем монтировании
```

---

## Сценарий 2 — Сервер возвращает авторитетный объект

**Ситуация**: POST-запрос создаёт новый элемент. Сервер возвращает созданный объект с серверными полями (`id`, `createdAt`, и т.д.), которые мы не знали заранее.

Здесь оптимистик применяем с временным `id`, а в `onSuccess` заменяем его на авторитетные данные сервера.

```ts
type Task = {
	id: string;
	title: string;
	status: "pending" | "done";
	createdAt: string; // поле генерирует сервер
};
type NewTask = Omit<Task, "id" | "createdAt">;

const TEMP_ID = "optimistic-temp";

export const useCreateTaskMutation = () => {
	const queryClient = useQueryClient();
	const notify = useNotify();

	return useMutation({
		mutationFn: (data: NewTask) => fetchJsonMutationFn<Task, NewTask>("/TaskSet", "POST", "odata")(data),

		// Оптимистично добавляем задачу с временным id
		onMutate: async (newTask) =>
			onMutateOptimistic<Task[]>(queryClient, tasksQueryKey, (old) => [...(old ?? []), { ...newTask, id: TEMP_ID, createdAt: "" }]),

		// Сервер ответил ошибкой — убираем временную задачу
		onError: (error, _, context) => {
			onErrorOptimistic(queryClient, tasksQueryKey, context);
			notify.error("Задача не создана");
			console.error(error);
		},

		// Сервер вернул авторитетный объект — заменяем временный элемент на него
		onSuccess: (createdTask) => {
			onSuccessOptimistic<Task[], Task>(
				queryClient,
				tasksQueryKey,
				createdTask,
				(cache, task) => cache?.map((t) => (t.id === TEMP_ID ? task : t)) ?? [task]
			);
			notify.success(`Задача '${createdTask.title}' создана`);
		},

		// Инвалидируем: сервер мог добавить поля или изменить порядок
		onSettled: () => onSettledOptimistic(queryClient, tasksQueryKey, { refetchType: "active" })
	});
};
```

**Что происходит с кешем**:

```
До мутации:      [{ id: "abc", title: "Задача 1", ... }]
После onMutate:  [{ id: "abc", ... }, { id: "optimistic-temp", title: "Задача 2", createdAt: "" }]
После onSuccess: [{ id: "abc", ... }, { id: "xyz-server-id", title: "Задача 2", createdAt: "2026-04-19" }]
```

---

## Сценарий 3 — Инвалидация нескольких ключей с рефетчем

**Ситуация**: одна мутация затрагивает несколько связанных запросов — например, изменение статуса заказа обновляет и список заказов, и счётчики в шапке.

```ts
const orderQueryKey = ["orders", orderId] as const;
const counterQueryKey = ["orders", "counters"] as const;

export const useUpdateOrderStatusMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: UpdateOrderStatus) =>
			fetchJsonMutationFn<void, UpdateOrderStatus>(`/OrderSet('${data.id}')`, "PATCH", "odata")(data),

		onMutate: async (data) =>
			onMutateOptimistic<Order>(queryClient, orderQueryKey, (old) => (old ? { ...old, status: data.status } : old)),

		onError: (_, __, context) => onErrorOptimistic(queryClient, orderQueryKey, context),

		// Инвалидируем оба ключа: заказ и счётчики.
		// refetchType: "active" — немедленный рефетч, потому что счётчики критичны.
		onSettled: () => onSettledOptimistic(queryClient, [orderQueryKey, counterQueryKey], { refetchType: "active" })
	});
};
```

---

## Стратегии `onSettled`

Выбор `refetchType` зависит от того, насколько критична актуальность данных:

| `refetchType`           | Когда использовать                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `"none"` (по умолчанию) | Данные уже актуальны после оптимистика; рефетч не нужен немедленно. Данные обновятся при следующем монтировании.    |
| `"active"`              | Данные видны прямо сейчас и должны быть абсолютно точными (счётчики, балансы, статусы с бизнес-логикой на сервере). |
| `"inactive"`            | Нужно обновить кеш фоновых запросов, чтобы при следующем открытии страницы данные были свежими.                     |
| `"all"`                 | Нужно синхронизировать всё — например, после глобального действия (смена роли, очистка данных).                     |

---

## Интеграция с мультивкладочным broadcast

`onSettledOptimistic` намеренно **не делает** broadcast в другие вкладки. Это ответственность вызывающего кода — так сохраняется разделение ответственности.

Типичный паттерн:

```ts
onSettled: async () => {
  // 1. Инвалидируем локально
  await onSettledOptimistic(queryClient, myQueryKey);

  // 2. Уведомляем другие вкладки
  broadcastCacheEvent({
    type: "invalidate",
    keys: [myQueryKey],
    refetchType: "none",
  });
},

onSuccess: (_, variables) => {
  // Если хотим немедленно синхронизировать оптимистичное состояние в другие вкладки
  const current = queryClient.getQueryData(myQueryKey);
  if (current) {
    broadcastCacheEvent({ type: "setQueryData", key: myQueryKey, data: current });
  }
},
```

Подробнее о broadcast: [README.md](./README.md).

---

## Типовые ошибки

### 1. Забыть `cancelQueries` перед патчем

Без отмены конкурирующих запросов фоновый рефетч может «перезаписать» оптимистичное состояние. `onMutateOptimistic` делает это автоматически.

### 2. Мутировать кеш напрямую (без иммутабельности)

```ts
// Неправильно
onMutate: (data) => {
	const old = queryClient.getQueryData<Task[]>(key);
	old?.find((t) => t.id === data.id)!.visible = data.visible; // ← мутация объекта
	queryClient.setQueryData(key, old);
};

// Правильно — создаём новый массив и новый объект
onMutate: (data) =>
	onMutateOptimistic<Task[]>(queryClient, key, (old) => old?.map((t) => (t.id === data.id ? { ...t, visible: data.visible } : t)));
```

React не увидит изменений при мутации существующего объекта — компонент не перерисуется.

### 3. Не обрабатывать `context === undefined` в `onError`

TanStack Query передаёт `context` как `TContext | undefined` — если `onMutate` сам выбросил исключение, `context` будет `undefined`. `onErrorOptimistic` учитывает этот случай и безопасно ничего не делает.

### 4. Использовать `refetchType: "active"` везде

Это вызывает лишние HTTP-запросы. Для большинства оптимистичных операций данные в кеше уже корректны — используйте `"none"` по умолчанию и `"active"` только там, где точность критична.
