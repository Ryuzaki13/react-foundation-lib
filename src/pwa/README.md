# PWA и Service Worker в проекте

## Зачем нужен этот документ

Этот документ описывает всю PWA-цепочку в проекте:

- как собираются PWA-манифесты;
- как `sw.js` появляется в сборке;
- как ABAP отдает HTML, manifest и service worker;
- когда и где service worker регистрируется в браузере;
- какие данные и ассеты кэшируются;
- как устроено обновление service worker;
- что нужно сделать, чтобы включить новое подприложение в PWA;
- какие ограничения и риски есть в текущей реализации.

Документ описывает текущее фактическое поведение проекта, а не абстрактную "идеальную" схему.

---

## 1. Общая идея архитектуры

Проект представляет собой одно SPA-приложение, но внутри него есть несколько "псевдо-подприложений".

Основные маршруты:

- `/arm/` — главная страница;
- `/arm/app/<appId>` — SPA-режим подприложения;
- `/arm/apps/<appId>/<viewId>` — SPA-режим с отдельными представлениями;
- `/arm/pwa/<appId>` — специальный PWA-вход для подприложения.

Ключевая идея:

- service worker регистрируется для всего приложения внутри `/arm`;
- scope у него `/arm/`, поэтому он контролирует всё SPA внутри этого basepath;
- маршрут `/arm/pwa/<appId>` нужен не для самой регистрации worker, а как специальный PWA-entry с app-specific manifest.

---

## 2. Основные файлы

### Сборка и генерация PWA

- [vite.config.ts](/vite.config.ts)
- [config/vite/plugins.ts](/config/vite/plugins.ts)
- [config/vite/plugins/buildPWA.ts](/config/vite/plugins/buildPWA.ts)
- [public/pwa-base.json](/public/pwa-base.json)
- `src/apps/spa/*/pwa.json`

### Service Worker

- [src/app/sw.ts](/src/app/sw.ts)
- [src/shared/lib/pwa/serviceWorker.ts](/src/shared/lib/pwa/serviceWorker.ts)
- [src/shared/lib/pwa/useServiceWorkerUpdate.ts](/src/shared/lib/pwa/useServiceWorkerUpdate.ts)
- [src/widgets/service-worker-update-banner/ui/ServiceWorkerUpdateBanner.tsx](/src/widgets/service-worker-update-banner/ui/ServiceWorkerUpdateBanner.tsx)

### Роуты и shell

- [src/app/routes/pwa/$appId.tsx](/src/app/routes/pwa/$appId.tsx)
- [src/app/ui/shell/RootLayout.tsx](/src/app/ui/shell/RootLayout.tsx)

### Серверная выдача через ABAP

- [abap/ZCL_REACT_APP_HANDLER.abap](/abap/ZCL_REACT_APP_HANDLER.abap)

### Интеграция OData-кэша

- [src/shared/api/odata/odataFetch.ts](/src/shared/api/odata/odataFetch.ts)
- [src/shared/api/odata/transport/fetch.ts](/src/shared/api/odata/transport/fetch.ts)
- [src/shared/api/odata/useODataCollectionQuery.ts](/src/shared/api/odata/useODataCollectionQuery.ts)

---

## 3. Как собирается PWA

### 3.1. Базовый механизм

В проекте используется `vite-plugin-pwa` в режиме `injectManifest`.

Это значит:

- service worker пишется вручную в [src/app/sw.ts](/src/app/sw.ts);
- плагин не генерирует всю логику сам;
- он только внедряет в `sw.ts` список precache-ресурсов.

### 3.2. Базовый и app-specific manifest

Есть базовый manifest:

- [public/pwa-base.json](/public/pwa-base.json)

Для каждого PWA-подприложения может существовать override:

- `src/apps/spa/<appId>/pwa.json`

Во время сборки плагин [buildPWA.ts](/config/vite/plugins/buildPWA.ts) делает следующее:

1. читает `public/pwa-base.json`;
2. ищет все `src/apps/spa/*/pwa.json`;
3. для каждого найденного файла объединяет базовый manifest с app-specific override;
4. принудительно задаёт:
    - `id = <appId>`
    - `start_url = /arm/pwa/<appId>`
5. сохраняет итоговый файл в `dist/pwa/manifest.<appId>.json`.

Пример:

- `src/apps/spa/mrmRecognitionWagons/pwa.json`
- результат сборки: `dist/pwa/manifest.mrmRecognitionWagons.json`

### 3.3. Что делает `webmanifest.json`

`vite-plugin-pwa` также создаёт обычный `webmanifest.json`, но в текущей архитектуре он не является главным manifest для PWA-входа.

Практически используется app-specific manifest, который ABAP вставляет в HTML для `/arm/pwa/<appId>`.

---

## 4. Как фильтруется precache

Фильтрация выполняется в [config/vite/plugins.ts](/config/vite/plugins.ts).

### В precache не попадают

- `webmanifest.json`
- `index.js`
- `style.css`

Это важное поведение.

Почему `index.js` и `style.css` исключены:

- ABAP отдает их с cachebuster-параметром `?t=...`;
- если держать их в precache и одновременно игнорировать параметр `t`, старый service worker может раздавать старые entrypoint-файлы после деплоя;
- поэтому эти два файла обновляются через новый URL, а не через precache.

### В precache попадают

- общие чанки `assets/chunks/*`;
- общие иконки и шрифты;
- app-specific manifest `pwa/manifest.<appId>.json`;
- только те `assets/apps/*`, которые соответствуют приложениям, у которых действительно есть `pwa.json`.

Это означает:

- если приложение не объявлено как PWA через `pwa.json`, его app chunk в precache не попадет;
- service worker не будет тянуть в precache все SPA-подприложения подряд.

---

## 5. Как ABAP отдает PWA-ресурсы

Важная часть схемы находится в [abap/ZCL_REACT_APP_HANDLER.abap](/abap/ZCL_REACT_APP_HANDLER.abap).

### 5.1. Проксирование `/sw.js`

Когда клиент запрашивает `/arm/sw.js`, ABAP не отдает статический файл напрямую.

Он возвращает маленький proxy-script:

```js
importScripts("/sap/bc/ui5_ui5/sap/TEXT_APP/sw.js?t=<cache_token>");
```

Зачем это нужно:

- браузер регистрирует стабильный URL `/arm/sw.js`;
- внутри него подгружается реальный BSP-файл `sw.js` с cachebuster-параметром;
- при смене токена браузер видит обновление service worker.

Также для `/sw.js` ABAP ставит заголовки без кеширования:

- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

### 5.2. Генерация HTML для `/arm/pwa/<appId>`

При запросе маршрута `/arm/pwa/<appId>` ABAP:

1. извлекает `appId` из пути;
2. генерирует HTML-обертку;
3. вставляет в `<head>` ссылку:

```html
<link rel="manifest" href="/sap/bc/ui5_ui5/sap/TEXT_APP/pwa/manifest.<appId>.json" />
```

Также ABAP вставляет:

- `index.js?t=<cache_token>`
- `style.css?t=<cache_token>`

Именно поэтому при "настоящем" входе по URL `/arm/pwa/<appId>` браузер получает app-specific manifest.

### 5.3. Что важно понимать про manifest

Сейчас app-specific manifest гарантированно подключается именно на серверной выдаче HTML для `/arm/pwa/<appId>`.

Это значит:

- если пользователь открывает `/arm/pwa/<appId>` напрямую в браузере, нужный manifest будет подключён;
- если пользователь попал в уже загруженное SPA и затем только клиентской навигацией перешёл на `/pwa/<appId>`, manifest не переключается автоматически через route head.

Это не баг service worker, а особенность текущей схемы внедрения manifest.

---

## 6. Как и когда регистрируется service worker

Клиентская регистрация находится в [src/shared/lib/pwa/serviceWorker.ts](/src/shared/lib/pwa/serviceWorker.ts).

### 6.1. Когда регистрируется SW

Регистрация выполняется для всего приложения:

- shell вызывает `registerServiceWorker()` глобально;
- в production регистрируется `/arm/sw.js`;
- в development регистрируется `/sw.js`.

Иными словами, заходить в `/arm/pwa/<appId>` для самой регистрации service worker больше не требуется.

### 6.2. Какой scope получает SW

Scope задаётся как:

- `/` в dev;
- `/arm/` в production.

Это очень важно:

- service worker регистрируется сразу на всё приложение;
- он контролирует весь `/arm`, а не только `/arm/pwa/`.

### 6.3. Что изменилось в текущей логике обновления

Фоновая проверка обновлений живёт в общем shell.

Логика такая:

- shell регистрирует service worker для всего приложения;
- shell периодически вызывает `reg.update()`;
- если новый worker установлен и ждёт активации, баннер обновления показывается на любом маршруте;
- PWA-маршрут больше не является условием для update flow.

---

## 7. Как устроен UI обновления service worker

Хук:

- [src/shared/lib/pwa/useServiceWorkerUpdate.ts](/src/shared/lib/pwa/useServiceWorkerUpdate.ts)

Баннер:

- [src/widgets/service-worker-update-banner/ui/ServiceWorkerUpdateBanner.tsx](/src/widgets/service-worker-update-banner/ui/ServiceWorkerUpdateBanner.tsx)

Размещение:

- [src/app/ui/shell/RootLayout.tsx](/src/app/ui/shell/RootLayout.tsx)

### Механика

1. Приложение вызывает `registerServiceWorker()`.
2. Затем периодически вызывает `checkServiceWorkerUpdate()`.
3. Если новый worker установлен и находится в состоянии `waiting`, показывается баннер "Доступна новая версия приложения".
4. По кнопке "Обновить" вызывается `applyServiceWorkerUpdate()`.
5. Клиент посылает `waiting.postMessage({ type: "SKIP_WAITING" })`.
6. Новый SW активируется.
7. Новый SW отправляет всем window-клиентам сообщение `SW_ACTIVATED_BY_CLIENT`.
8. Вкладка, где пользователь нажал "Обновить", перезагружается на `controllerchange`.
9. Остальные вкладки перезагружаются по сообщению от активированного worker.

Если в другой вкладке worker уже успел активироваться, а текущая вкладка всё ещё показывает старый баннер, кнопка "Обновить" запускает обычную перезагрузку страницы. Это fallback для stale-состояния, когда `registration.waiting` уже пустой.

### Почему обновление controlled, а не автоматическое

В [src/app/sw.ts](/src/app/sw.ts) `skipWaiting()` не вызывается сразу при установке.

Это сделано специально:

- новый worker не перехватывает приложение без подтверждения;
- пользователь сам решает момент обновления;
- это безопаснее для SPA, которое уже работает с открытым состоянием и активными запросами.

---

## 8. Что именно делает service worker

Исходная логика worker находится в [src/app/sw.ts](/src/app/sw.ts).

### 8.1. Работа с BSP-путями

Все precache URL приводятся к BSP-базе:

- `/sap/bc/ui5_ui5/sap/TEXT_APP/...`

Это нужно, потому что реальные статические ресурсы лежат в BSP, а не по относительным Vite-путям.

### 8.2. Precache

Через `precacheAndRoute(...)` worker кэширует список ресурсов сборки, который внедрил `vite-plugin-pwa`.

При этом для matching precache игнорируется параметр `t`.

Это допустимо для большинства precache-ресурсов, но именно поэтому `index.js` и `style.css` были исключены из precache.

### 8.3. Навигация по `/arm/pwa/`

Для навигационных запросов на `/arm/pwa/...` используется `NetworkFirst`.

Идея:

- сначала пробуем сеть;
- если сеть недоступна, пробуем вернуть кэшированный HTML.

### 8.4. Статические ассеты

Для скриптов, стилей и `assets/*` используется `CacheFirst`.

Идея:

- если файл уже есть в runtime-кэше, отдаем его оттуда;
- если нет, тянем из сети и сохраняем.

### 8.5. Изображения

Для изображений используется `StaleWhileRevalidate` с ограничениями по объёму и времени жизни.

### 8.6. SSO/Auth исключения

Есть явные обходы для путей типа:

- `/sso.`
- `/auth/`

Такие запросы не должны случайно кэшироваться worker’ом.

---

## 9. Как устроен OData-кэш в service worker

Это одна из самых важных частей текущей архитектуры.

### Ключевая идея

OData-кэш не применяется "магически ко всем запросам".

Он включается только если клиент сам передал заголовок:

```http
x-sw-cache: ttl=...
```

Именно это делает схему безопасной и управляемой.

### Где клиент выставляет политику

Заголовок добавляется в:

- [src/shared/api/odata/odataFetch.ts](/src/shared/api/odata/odataFetch.ts)
- [src/shared/api/odata/transport/fetch.ts](/src/shared/api/odata/transport/fetch.ts)

### Поддерживаемые политики

- `off`
  network-only
- `ttl=<duration>`
  cache-first с TTL
- `bust=<duration>`
  принудительное обновление кэша из сети

`duration` задаётся числом и единицей времени:

- `ms` — миллисекунды;
- `s` — секунды;
- `m` — минуты;
- `h` — часы;
- `d` — дни.

Примеры:

```text
ttl=24h
ttl=10m
bust=6h
```

### Опциональные параметры политики

После основной части можно передать параметры через `;` или `,`.

- `max`, `maxEntries`, `entries`
  максимальное количество записей в Cache Storage для этой политики;
- `name`, `cache`, `cacheName`
  читаемый сегмент имени кеша.

Примеры:

```text
ttl=24h;max=100;name=ref
ttl=10m;max=200;name=ui
bust=30s;entries=300;cache=fast
```

Если `max` не указан, используется стандартный лимит `100` записей. Значение `max` ограничивается верхней границей `5000`, чтобы ошибочный ввод не раздувал Cache Storage бесконтрольно.

### Как это работает внутри SW

1. Worker ловит только запросы к `/sap/opu/odata/sap/...`.
2. Читает `x-sw-cache`.
3. Удаляет служебный заголовок перед уходом в сеть.
4. Парсит политику из строки, без фиксированного списка профилей.
5. Если задан `ttl=...`:
    - сначала ищет запись в Cache Storage;
    - если TTL не истек, возвращает кэш;
    - если истек, удаляет запись и делает сетевой запрос.
6. Если задан `bust=...`:
    - всегда идёт в сеть;
    - обновляет запись в Cache Storage.

### Дополнительные механизмы

- `in-flight dedupe`
  защищает от пачки одинаковых запросов при одновременном старте нескольких вкладок;
- `x-sw-cached-at`
  внутренний заголовок с меткой времени, по которому проверяется TTL;
- ручная инвалидция через `invalidateSwCacheProfile(profile)`, где `profile` должен быть полной политикой вроде `ttl=24h;name=ref`.

### Где это уже используется

Например, в [useODataCollectionQuery.ts](/src/shared/api/odata/useODataCollectionQuery.ts) по умолчанию стоит:

```ts
swCache = "ttl=24h;name=ref";
```

Это означает:

- справочники уже подготовлены к SW-кэшированию;
- TTL справочников по умолчанию равен 24 часам, а кеш получает имя `ref`;
- схема не только про shell и installability, но и про offline/cache-стратегию данных.

---

## 10. Как добавить новое PWA-подприложение

Чтобы новое приложение участвовало в PWA-схеме, нужно:

### Шаг 1. Создать app-specific manifest override

Добавить файл:

`src/apps/spa/<appId>/pwa.json`

Минимально обычно достаточно:

```json
{
	"name": "Полное имя приложения",
	"short_name": "Короткое имя",
	"description": "Описание"
}
```

### Шаг 2. Собрать проект

Во время сборки:

- manifest будет объединён с `public/pwa-base.json`;
- получится `dist/pwa/manifest.<appId>.json`.

### Шаг 3. Убедиться, что приложение открывается по `/arm/pwa/<appId>`

Именно этот маршрут используется как PWA entrypoint.

### Шаг 4. Проверить precache

Если у приложения появился `pwa.json`, его `assets/apps/spa-<appId>-...js` должен начать попадать в precache service worker.

### Шаг 5. При необходимости подключить OData-кэширование

Если приложению нужны offline/кешируемые справочники или короткоживущие данные:

- использовать `swCache: "ttl=..."` или `swCache: "bust=..."` в query/fetch-слое.

---

## 11. Как обновляется приложение после деплоя

Текущая схема обновления выглядит так:

1. На проде выкатывается новая сборка.
2. ABAP отдает:
    - новый `index.js?t=<new_token>`
    - новый `style.css?t=<new_token>`
    - proxy-версию `/arm/sw.js`, которая внутри импортирует новый BSP `sw.js?t=<new_token>`.
3. Клиентский shell периодически вызывает `registration.update()`.
4. Браузер скачивает новый worker.
5. Worker становится `waiting`.
6. Пользователь видит баннер обновления.
7. После подтверждения новый worker активируется и перезагружает все открытые вкладки приложения.

Если за время простоя вкладки накопилось несколько версий, после reload клиент держит короткое startup-окно автоматического применения waiting worker. Поэтому цепочка версий дожимается несколькими автоматическими reload без повторного ручного клика. Чтобы не получить бесконечную перезагрузку при ошибочной выдаче `sw.js`, автоцепочка ограничена счётчиком в `sessionStorage`; после лимита снова показывается обычный баннер.

### Важная деталь

`index.js` и `style.css` теперь не лежат в precache.

Это критично для корректного деплоя:

- старый active worker больше не может упрямо раздавать старые entrypoint-файлы, игнорируя `?t=...`;
- entrypoint-ы обновляются по серверному cachebuster-токену.

---

## 12. Текущие ограничения и важные замечания

### 12.1. Manifest переключается сервером, а не SPA-маршрутизатором

Сейчас app-specific manifest гарантированно подключается только когда HTML был сформирован ABAP для `/arm/pwa/<appId>`.

Следствие:

- прямой вход по URL работает как ожидается;
- чисто клиентская навигация внутри уже открытого SPA не гарантирует смену manifest.

### 12.2. Worker регистрируется на всё приложение

Текущая архитектура больше не привязывает регистрацию service worker к `/arm/pwa/...`.

Следствие:

- worker появляется и на обычных маршрутах SPA;
- update flow и баннер обновления тоже работают глобально.

### 12.3. Worker живет на всём `/arm`

Это не ошибка, а запланированное поведение из-за scope `/arm/`.

Следствие:

- и обычные SPA-маршруты, и `/arm/pwa/...` обслуживаются одним и тем же service worker;
- PWA-маршрут отличается не регистрацией worker, а использованием app-specific manifest и PWA-entry поведения.

### 12.4. Offline fallback пока неполный

В коде worker ожидает `offline.html`, но в текущем проекте полноценная offline-страница пока не оформлена как часть законченого UX.

То есть:

- механизм fallback в коде есть;
- полноценный offline-сценарий ещё не доведён до финального состояния.

### 12.5. Runtime-кэш статики требует аккуратности

Сейчас для `script/style/assets` используется `CacheFirst`.

Это полезно для производительности, но любые изменения в стратегиях кэширования надо делать осторожно, потому что они напрямую влияют на поведение деплоя и обновления клиента.

---

## 13. Рекомендации по сопровождению

### Что можно менять безопасно

- содержимое `src/apps/spa/*/pwa.json`;
- названия, описания, иконки, `short_name`;
- `swCache`-политику на уровне конкретных OData-запросов.

### Что нужно менять очень осторожно

- `scope` и `start_url` в базовом manifest;
- правила фильтрации precache в [config/vite/plugins.ts](/config/vite/plugins.ts);
- логику ABAP-проксирования `/sw.js`;
- исключение `index.js` и `style.css` из precache;
- правила `ignoreURLParametersMatching`.

### Что обязательно проверять после изменений

1. Прямой вход в `/arm/pwa/<appId>`.
2. Регистрацию service worker в браузере.
3. Появление app-specific manifest.
4. Обновление после нового деплоя.
5. Поведение update flow на любых маршрутах `/arm/...`.
6. OData-запросы с `swCache`, если менялась data-cache логика.

---

## 14. Короткая памятка

### Если нужно добавить новое PWA-приложение

Сделать `src/apps/spa/<appId>/pwa.json`.

### Если после деплоя отдаются старые чанки

Сначала проверить:

- не попали ли `index.js` и `style.css` обратно в precache;
- меняется ли ABAP cachebuster token;
- обновляется ли `/arm/sw.js`.

### Если не работает OData-кэш

Проверить:

- выставляется ли `x-sw-cache`;
- идёт ли запрос на `/sap/opu/odata/sap/...`;
- корректно ли политика парсится как `off`, `ttl=<число><единица>` или `bust=<число><единица>`.

### Если пользователь не видит баннер обновления

Проверить:

- был ли вообще зарегистрирован service worker;
- появился ли у registration `waiting` worker.

---

## 15. Вывод

Текущая реализация PWA в проекте построена вокруг идеи:

- service worker работает на всём приложении внутри `/arm`;
- manifest привязан к конкретному appId;
- кэширование статических ресурсов и OData уже частично подготовлено для расширения PWA на всё приложение.

Это не "просто service worker для install prompt", а полноценный каркас для:

- app-specific PWA entrypoint;
- controlled update flow;
- selective precache;
- управляемого кэширования OData.

Главное, что нельзя забывать при дальнейших изменениях:

- manifest, ABAP cachebuster, precache-фильтрация и runtime-кэш тесно связаны между собой;
- менять одну часть без понимания всей цепочки опасно.
