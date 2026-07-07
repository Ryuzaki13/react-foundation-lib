# Query Client

Модуль `src/shared/lib/query-client` содержит общую инфраструктуру TanStack Query:

- создание singleton `QueryClient`;
- opt-in сохранение справочных query в IndexedDB;
- синхронизацию кэша и прикладных cache-событий между вкладками.

Полная схема кеширования OData metadata, version-check и справочников описана в [docs/odata-reference-cache.md](/docs/odata-reference-cache.md).

## IndexedDB persistence для справочников

### Назначение

Модуль [persistence.ts](/src/shared/lib/query-client/persistence.ts) сохраняет выбранные данные TanStack Query в IndexedDB.

Задача этого слоя — переживать перезагрузку страницы и повторный вход в SPA для тяжёлых справочных данных, не используя `localStorage`.

Почему не `localStorage`:

- он синхронный и может блокировать UI на больших payload;
- браузерные лимиты обычно заметно ниже;
- объёмы справочников в ARM могут доходить до 100-200 МБ;
- IndexedDB лучше подходит для больших асинхронных клиентских хранилищ.

Почему не Service Worker:

- SW runtime cache работает на уровне HTTP-запросов;
- React Query persistence работает на уровне уже нормализованных query-данных;
- текущая реализация не зависит от регистрации SW и работает в обычном SPA-входе.

### Как это подключено

Persistence подключается в [queryClient.ts](/src/shared/lib/query-client/queryClient.ts) при создании `QueryClient`:

```ts
export function createQueryClient({ onQueryError, onMutationError }: QueryBroadcastOptions) {
	const queryPersister = createReactQueryPersister();

	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 10 * 60 * 1000,
				gcTime: 30 * 60 * 1000,
				...(queryPersister ? { persister: queryPersister.persisterFn } : {})
			}
		}
	});
}
```

Если код выполняется не в браузере или `indexedDB` недоступен, `createReactQueryPersister()` возвращает `undefined`, а `QueryClient` создаётся без persistence.

### Главный принцип: opt-in

Сохраняются не все query, а только те, которые явно помечены:

```ts
meta: persistedQueryMeta;
```

`persistedQueryMeta` экспортируется из `@/shared/lib` и имеет форму:

```ts
export const persistedQueryMeta = { persist: true } as const;
```

Фильтр persistence проверяет это так:

```ts
export function shouldPersistQuery(query: Pick<Query, "meta">) {
	return query.meta?.persist === true;
}
```

Это важно для безопасности и управляемости объёма:

- transient UI-запросы не попадают в IndexedDB;
- пользовательские или чувствительные данные не начинают сохраняться случайно;
- размер persistent cache растёт только там, где это осознанно включили.

### Что сохраняется сейчас

На текущем этапе persistence включён только для справочников:

- OData metadata в [useODataMetadataQuery.ts](/src/shared/api/odata/useODataMetadataQuery.ts);
- OData metadata-version в [metadataVersionCheck.ts](/src/shared/api/odata/metadataVersionCheck.ts);
- OData collection-updates в [useODataCollectionUpdatesQuery.ts](/src/shared/api/odata/useODataCollectionUpdatesQuery.ts);
- OData collection в [useODataCollectionQuery.ts](/src/shared/api/odata/useODataCollectionQuery.ts).

Пример metadata query:

```ts
export const odataMetadataQueryOptions = (options: ODataMetadataOptions) =>
	queryOptions({
		queryKey: [...odataBaseQueryKey, "metadata", options],
		queryFn: fetchMetadata(options),
		meta: persistedQueryMeta,
		staleTime: Infinity,
		gcTime: Infinity
	});
```

Пример collection query:

```ts
return useQuery({
	queryKey,
	queryFn: fetchCollection,
	enabled: Boolean(!isLoading && metadata && service && target),
	meta: persistedQueryMeta,
	staleTime: 1000 * 60 * 60 * 2,
	gcTime: 1000 * 60 * 60
});
```

### Как устроено хранилище

`createIndexedDbQueryStorage()` создаёт storage-адаптер под интерфейс `AsyncStorage` из `@tanstack/query-persist-client-core`.

Он реализует методы:

```ts
type QueryStorage<T> = {
	getItem: (key: string) => Promise<T | undefined | null>;
	setItem: (key: string, value: T) => Promise<unknown>;
	removeItem: (key: string) => Promise<void>;
	entries: () => Promise<Array<[key: string, value: T]>>;
};
```

Физически данные лежат в:

- database: текущий system/client контекст, в dev-режиме `dev`;
- object store: `queries`.

`entries()` нужен не для обычного lazy restore конкретной query, а для служебных сценариев TanStack persister: garbage collection, массовое восстановление и удаление query.

### Как формируются ключи IndexedDB

TanStack persister сохраняет каждую query отдельной записью.

Ключ записи строится из:

- `prefix`;
- `queryHash`.

В ARM prefix учитывает system/client контекст:

```ts
<system>:cache
```

Это не смешивает кэш разных окружений, например разных SAP-систем и клиентов.

Пример итогового ключа в IndexedDB:

```text
<system>:cache-["odata","metadata",{"service":"ZARM_APP_SRV"}]
```

Фактический `queryHash` формирует TanStack Query, поэтому руками такие ключи создавать не нужно.

### Что лежит в записи

Каждая запись соответствует типу `PersistedQuery`:

```ts
type PersistedQuery = {
	buster: string;
	queryHash: string;
	queryKey: QueryKey;
	state: QueryState;
};
```

В `state` лежат данные query и служебные timestamps TanStack Query, включая `dataUpdatedAt`.

Мы не сериализуем данные в JSON вручную:

```ts
serialize: (query) => query,
deserialize: (query) => query
```

IndexedDB умеет хранить structured clone, поэтому можно сохранять объект напрямую. Это уменьшает лишнюю сериализацию больших справочников.

### Жизненный цикл query

Когда компонент вызывает `useQuery` с `meta: persistedQueryMeta`, происходит такой сценарий:

1. TanStack Query создаёт query в памяти.
2. `persisterFn` проверяет `meta.persist`.
3. Если данных в памяти ещё нет, persister пробует прочитать запись из IndexedDB по `queryHash`.
4. Если запись найдена, не протухла и совпадает с `buster`, данные возвращаются из IndexedDB.
5. Если восстановленные данные stale, TanStack Query запускает фоновый refetch.
6. Если записи нет или она невалидна, выполняется обычный `queryFn`.
7. После успешного `queryFn` persister сохраняет результат в IndexedDB.

Таким образом, persistence не делает отдельный общий hydrate всего приложения на старте. Query восстанавливается лениво, только когда она реально нужна.

### Fresh, stale и maxAge

Важные настройки:

```ts
export const REACT_QUERY_PERSISTENCE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

experimental_createQueryPersister({
	maxAge: REACT_QUERY_PERSISTENCE_MAX_AGE,
	refetchOnRestore: true
});
```

`maxAge` — максимальный возраст persistent записи. Сейчас он равен 90 дням: это позволяет IndexedDB постепенно очистить старые ключи после смены `buildId`.

`staleTime` остаётся настройкой конкретной query:

- если восстановленные данные ещё fresh, `queryFn` не вызывается сразу;
- если восстановленные данные stale, они могут быть показаны из IndexedDB, а затем обновятся фоновым refetch;
- если запись старше текущего `maxAge`, она не будет использоваться.

Пример: `useODataCollectionQuery` имеет `staleTime` 2 часа и persistent `maxAge` 90 дней. Значит:

- через 2 часа данные восстановятся и не пойдут в сеть сразу;
- после 2 часов данные восстановятся, но TanStack Query сможет запустить refetch;
- после 90 дней запись не будет использоваться и сможет быть очищена persister-ом.

Для OData metadata и справочников свежесть дополнительно контролируется technical query: `metadata-version` и `collection-updates`.

### Cache busting

Для принудительной инвалидции старого persistent cache используется `buster`:

```ts
export const REACT_QUERY_PERSISTENCE_BUSTER = "arm-rq-persist-v3";
```

Если формат persisted данных или правила кэширования меняются несовместимо, нужно поднять версию, например:

```ts
export const REACT_QUERY_PERSISTENCE_BUSTER = "arm-rq-persist-v4";
```

После этого старые записи с `v3` будут отброшены при чтении.

### Как добавить persistence для новой справочной query

Если query действительно является справочной и её безопасно хранить между перезагрузками, добавьте `meta: persistedQueryMeta`:

```ts
import { useQuery } from "@tanstack/react-query";

import { persistedQueryMeta } from "@/shared/lib";

export function useDictionaryQuery(service: string) {
	return useQuery({
		queryKey: ["dictionary", service],
		queryFn: () => fetchDictionary(service),
		meta: persistedQueryMeta,
		staleTime: 1000 * 60 * 60 * 8,
		gcTime: 1000 * 60 * 60
	});
}
```

Для `queryOptions`:

```ts
import { queryOptions } from "@tanstack/react-query";

import { persistedQueryMeta } from "@/shared/lib";

export const dictionaryQueryOptions = (service: string) =>
	queryOptions({
		queryKey: ["dictionary", service],
		queryFn: () => fetchDictionary(service),
		meta: persistedQueryMeta,
		staleTime: 1000 * 60 * 60 * 8
	});
```

Перед добавлением проверьте:

- данные не содержат персональные transient-состояния;
- query key стабилен и включает все параметры, влияющие на результат;
- `staleTime` соответствует допустимой свежести данных;
- объём данных ожидаемо подходит для IndexedDB;
- мутации или внешние события корректно инвалидируют эту query при изменении справочника.

### Чего не стоит сохранять

Не включайте `persistedQueryMeta` для:

- данных текущей формы или черновиков UI;
- результатов поиска с высокоэнтропийными параметрами;
- персональных списков, которые часто меняются и должны всегда приходить с сервера;
- данных с короткой жизнью, где stale-результат хуже повторного запроса;
- больших таблиц, которые ещё не оформлены как отдельные TanStack queries.

### Отладка в браузере

Проверить записи можно в DevTools:

1. Открыть `Application`.
2. Перейти в `IndexedDB`.
3. Найти database текущего system/client контекста.
4. Открыть object store `queries`.
5. Проверить ключи с prefix `<system>:cache`.

Если нужно сбросить persistent cache вручную, можно удалить database текущего system/client контекста в DevTools.

### Тесты

Тесты находятся в [persistence.test.ts](/src/shared/lib/query-client/persistence.test.ts) и [queryPersistence.test.ts](/src/shared/api/odata/queryPersistence.test.ts).

Они проверяют:

- сохранение, чтение, удаление и перечисление записей IndexedDB storage;
- opt-in фильтр `meta.persist === true`;
- что per-query persister сохраняет только помеченные query;
- что `QueryClient` подключает persister только при доступном `indexedDB`;
- что OData metadata query помечена `persistedQueryMeta`.

Целевой запуск:

```bash
npx vitest src/shared/lib/query-client src/shared/api/odata --run
```

## Синхронизация кэша React Query между вкладками

## Назначение

Модуль [broadcast.ts](/src/shared/lib/query-client/broadcast.ts) синхронизирует клиентский кэш между вкладками одного браузера.

Он решает две разные задачи:

- синхронизирует состояние `QueryCache` через `broadcastQueryClient`;
- автоматически рассылает `invalidateQueries` через прикладной events-канал, потому что TanStack broadcast не передаёт invalidation-события;
- поддерживает ручные события `invalidate` и `setQueryData`, когда нужна явная команда другим вкладкам.

Это полезно для сценариев, где пользователь держит открытыми несколько вкладок ARM и ожидает, что изменения в одной вкладке быстро отразятся в остальных.

## Как это устроено

Модуль использует два `BroadcastChannel`:

- `queriesChannel`:
  нужен для низкоуровневой синхронизации кэша TanStack Query через `@tanstack/query-broadcast-client-experimental`;
- `eventsChannel`:
  нужен для наших прикладных событий, которые описаны типом `CacheSyncEvent`, и для автоматической рассылки локальных `invalidateQueries`.

Каждая вкладка при инициализации получает собственный `tabId`. Это позволяет:

- не обрабатывать свои же сообщения повторно;
- не зацикливать локальные обновления.

`broadcastQueryClient` передаёт успешные обновления query data: обычный `fetchQuery`, `useQuery` после успешной загрузки и `setQueryData`. Но `queryClient.invalidateQueries(...)` в TanStack Query создаёт action `invalidate`, а пакет `@tanstack/query-broadcast-client-experimental` его не отправляет. Поэтому wrapper дополнительно подписывается на `QueryCache` и рассылает invalidation по `eventsChannel`.

## Поддерживаемые события

### `invalidate`

Инвалидирует один или несколько query key в других вкладках.

Форма:

```ts
{
	type: "invalidate",
	keys: QueryKey[],
	refetchType?: "none" | "all" | "active" | "inactive"
}
```

Поведение:

- для каждого `queryKey` вызывается `queryClient.invalidateQueries`;
- если `refetchType` не передан, используется `"none"`.

### `setQueryData`

Принудительно обновляет данные конкретного query key в других вкладках.

Форма:

```ts
{
	type: "setQueryData",
	key: QueryKey,
	data: unknown
}
```

Поведение:

- в получателе вызывается `queryClient.setQueryData(key, data)`.

## Публичный API

### `installReactQueryBroadcast(queryClient, opts)`

Инициализирует синхронизацию и возвращает функцию `broadcast`.

Параметры:

- `queryClient`: экземпляр `QueryClient`;
- `opts.queriesChannel`: имя канала синхронизации query cache;
- `opts.eventsChannel`: имя канала прикладных событий.

Возвращает:

```ts
{
	broadcast: (event: CacheSyncEvent) => void,
	cleanup: () => void
}
```

Если код выполняется вне браузера, функция возвращает no-op реализацию и ничего не подписывает.

### `setBroadcastFn(fn)`

Сохраняет глобальную функцию-рассылку. Обычно вызывается один раз при старте приложения после `installReactQueryBroadcast`.

### `broadcastCacheEvent(event)`

Упрощённый способ отправить событие из любого места приложения, не передавая `broadcast` вручную по слоям.

## Текущая инициализация в проекте

Инициализация выполняется в [router.tsx](/src/app/router.tsx#L34):

```ts
const { broadcast } = installReactQueryBroadcast(queryClient, createQueryCacheBroadcastChannelNames());

setBroadcastFn(broadcast);
```

Это означает:

- синхронизация включается один раз на всё SPA;
- prefix каналов берётся из `VITE_QUERY_CACHE_BROADCAST_CHANNEL_PREFIX`;
- любые части приложения могут использовать `broadcastCacheEvent(...)`.
- обычные успешные query updates и локальные invalidation-события синхронизируются без ручных вызовов в feature-коде.

## Рекомендованные сценарии использования

### После обычного query update

Обычный `queryClient.setQueryData` уже синхронизируется через `broadcastQueryClient`. Дополнительный ручной `broadcastCacheEvent({ type: "setQueryData" })` нужен только если вызывающий код сознательно хочет отправить команду через прикладной events-канал.

```ts
queryClient.setQueryData(["tiles"], nextTiles);
```

### Принудительная отправка данных

```ts
broadcastCacheEvent({
	type: "setQueryData",
	key: ["tiles"],
	data: nextTiles
});
```

### После мутации, когда нужно мягко пометить данные устаревшими

Обычный `queryClient.invalidateQueries(...)` теперь автоматически передаётся другим вкладкам с `refetchType: "none"`.

Ручной вызов нужен, если требуется другой `refetchType` или нужно отправить сразу несколько ключей одной командой:

```ts
broadcastCacheEvent({
	type: "invalidate",
	keys: [["tiles"], ["menu"]],
	refetchType: "none"
});
```

### Когда нужно обновить только неактивные запросы

```ts
broadcastCacheEvent({
	type: "invalidate",
	keys: [["views", appId]],
	refetchType: "inactive"
});
```

## Ограничения и важные замечания

- Каналы работают только в браузерном окружении.
- Сообщения синхронизируются только между вкладками одного origin.
- Модуль не делает сериализацию “умнее”, чем `BroadcastChannel`. В `data` лучше передавать простые сериализуемые структуры.
- Runtime-проверки в модуле специально консервативные: невалидные сообщения просто игнорируются.
- `broadcastQueryClient` остаётся экспериментальной зависимостью TanStack, поэтому прикладные события `invalidate` и `setQueryData` у нас выделены отдельно и не завязаны только на её внутреннее поведение.
- Автоматическая invalidation отправляет конкретные `queryKey` уже найденных query. Широкий `queryClient.invalidateQueries()` в одной вкладке превращается в набор точечных invalidation-событий для query, которые реально есть в её кеше.

## Как проверить

Автоматическая проверка:

```bash
npm run test -- src/shared/lib/query-client/broadcast.test.ts src/shared/lib/query-client/broadcast.integration.test.ts
```

Что она доказывает:

- `broadcast.test.ts` проверяет wrapper, ручные events и автоматическую передачу `invalidateQueries`;
- `broadcast.integration.test.ts` использует реальный `broadcastQueryClient` из TanStack и подтверждает, что успешный `setQueryData` в одном `QueryClient` появляется во втором.

Ручная проверка в браузере:

1. Открыть одно и то же приложение в двух вкладках одного origin.
2. Включить React Query Devtools в обеих вкладках.
3. В первой вкладке открыть страницу, которая грузит metadata или справочник.
4. Во второй вкладке проверить, что query с тем же key появился или обновил `dataUpdatedAt` без собственной загрузки страницы.
5. В первой вкладке выполнить действие, которое вызывает `invalidateQueries` для видимого query.
6. Во второй вкладке убедиться, что тот же query стал stale или запустил refetch, если у него есть активный observer и выбранный `refetchType` это допускает.

## Что покрыто тестами

Тесты находятся в [broadcast.test.ts](/src/shared/lib/query-client/broadcast.test.ts) и [broadcast.integration.test.ts](/src/shared/lib/query-client/broadcast.integration.test.ts).

Они проверяют:

- no-op поведение вне браузера;
- вызов `broadcastQueryClient` с правильным каналом;
- передачу `invalidate`, включая `refetchType: "inactive"`;
- передачу `setQueryData`;
- автоматическую передачу локального `invalidateQueries`;
- реальную синхронизацию query data через TanStack broadcast;
- игнорирование невалидных входящих сообщений;
- работу `broadcastCacheEvent` через установленный handler.
