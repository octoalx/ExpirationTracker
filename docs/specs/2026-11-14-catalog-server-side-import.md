# Shared catalog: upload the DBF pair to the server on save

Status: APPROVED
Owner approval: Алекс, 14.11.2026, в чате: «реши просто три эти проблемы… после решения предоставь pull-реквесты, чтобы я просто их влил» (решения по открытым вопросам приняты агентом по поручению владельца)
Type: contract
Branch: claude/catalog-server-side-import
Spec gate: `npm run check:spec`

Supersedes AC1 of `docs/specs/2026-11-14-admin-shared-catalog-update.md` ("raw files
are never sent to the server"). That rule is removed by this spec's Contract change.

## Что изменится для вас

Вы выбираете `goods.dbf` и `barcode.dbf` и нажимаете «Сохранить каталог». Оба файла
одним запросом уходят на сервер, там разбираются и записываются в общий каталог.
Итог — «загружено N товаров». Если что-то пошло не так, вы видите код ответа,
понятный текст и число уже сохранённых записей. Ошибка «Unexpected token '<'» больше
не возникает: сообщения об ошибке приходят в JSON, а HTML-ответ сервера показывается
с кодом и текстом.

## Problem

Сейчас браузер разбирает DBF и отправляет `/api/admin/catalog` батчами по 500 записей
(`src/components/CatalogImport.tsx`, `src/lib/catalog-import.ts`). Наблюдаемый
сбой: при записи ~132 500 из 443 701 появляется `Unexpected token '<', "<!DOCTYPE"…`.
Это значит, что `response.json()` получил HTML-страницу вместо JSON, а код не
проверяет статус и тип ответа (`CatalogImport.tsx`, вызов `response.json()` до
`response.ok`). Источник HTML не подтверждён логами: `nginx/nginx.conf` не задаёт
`client_max_body_size` (по умолчанию 1 МБ), а сервер может отвечать страницей
ошибки во время перезапуска. Схема «сотни запросов с клиента» делает сбой вероятным
в любом случае.

## Decisions

- D1. Один запрос: тело — заголовок (8 байт магии `ECATDBF1`, два uint64 LE длины
  `goods.dbf` и `barcode.dbf`) и два файла подряд. Браузер собирает тело через `Blob`
  без чтения файлов в память.
- D2. Предпросмотр «Проверить файлы» убирается. Разбор полностью выполняется до первой
  записи, поэтому ошибка разбора по-прежнему ничего не меняет в каталоге.
- D3. Запись на сервере: один `INSERT … ON CONFLICT(barcode) DO UPDATE` на батч из
  500 записей. Каждый батч — один оператор, то есть атомарная единица; подтверждённые
  батчи остаются при сбое.
- D4. HTTP-запрос открыт до конца записи. Фоновый режим не делаем: при синтетическом
  замере время записи должно укладываться в AC8.
- D5. Временный файл тела создаётся в `os.tmpdir()` и удаляется в `finally`. В БД
  и постоянные файлы исходники не попадают.
- D6. Для нового пути загрузки в nginx задаётся `client_max_body_size 520m` и
  отдельный `location`; общий `location /` не меняется.

## Acceptance criteria

- AC1 — кнопка «Сохранить каталог» отправляет оба выбранных файла одним запросом на
  `POST /api/admin/catalog-upload`; браузер не разбирает DBF.
- AC2 — файлы больше 256 МиБ каждый, неверный заголовок или несовпадение длин
  отклоняются с русским сообщением до какой-либо записи в каталог.
- AC3 — сервер разбирает пару `parseDbfCatalog` (`src/lib/catalog-dbf.ts`) и пишет
  записи батчами по 500; ответ JSON содержит `imported` и счётчики разбора.
- AC4 — любой ответ, не являющийся JSON, на клиенте показывает код ответа и текст на
  русском; `response.json()` вызывается только после проверки `Content-Type`.
- AC5 — повторная загрузка той же пары не создаёт дублей; при сбое записи ответ
  содержит `confirmed` — число записей в уже подтверждённых батчах.
- AC6 — `POST` без сессии возвращает 401, для не-ADMIN — 403; тело не читается
  до проверки прав; временный файл удаляется в любом исходе.
- AC7 — личные `Product` и `CatalogEntry` не читаются и не меняются.
- AC8 — замер времени и пиковой памяти на синтетической паре 443 701 строки на
  локальной машине записан в Result. Замер на машине, сопоставимой с продом (2 ядра,
  1.9 ГБ RAM), в этой задаче не выполнен и остаётся открытым пунктом для релиза.
- AC9 — `nginx -t` проходит на обоих конфигах; отдельный `location` для upload
  имеет `client_max_body_size 520m`.

## Out of scope

- Фоновые задания с опросом статуса.
- Изменения схемы Prisma и миграции.
- Удаление личного `POST /api/catalog` и `CatalogEntry` (отдельная задача).
- Удаление `POST /api/admin/catalog`: оставлен, его тесты не меняются.
- Развёртывание на продакшн; `deploy.sh` и реальный импорт не запускаются.

## Files and signatures

- `src/lib/catalog-upload-format.ts` — `MAX_DBF_BYTES`, `CATALOG_UPLOAD_MAGIC`, `HEADER_BYTES`, `buildCatalogUploadBody(goods: File, barcodes: File): Blob`
- `src/lib/server/catalog-upload.ts` — `importCatalogUpload(req, prisma): Promise<CatalogUploadResult>`, `CatalogUploadError`, `upsertSharedCatalogBatch(prisma, batch)`
- `src/pages/api/admin/catalog-upload.ts` — `POST`, `config.api.bodyParser: false`
- `src/components/CatalogImport.tsx` — два файла, одна кнопка, без предпросмотра; ответ по `Content-Type`
- `src/lib/catalog-dbf.ts` — `MAX_DBF_BYTES` берётся из `catalog-upload-format.ts`; парсер без изменения логики
- `src/lib/catalog-import.ts` — удаляется (батчи переехали на сервер)
- `src/lib/catalog-dbf.worker.ts` — удаляется (разбор на сервере)
- `tests/catalog-import.test.ts` — удаляется вместе с `catalog-import.ts`
- `tests/catalog-upload.test.cjs` — новый: формат, 401/403, 400, 413, пара → счётчики, повтор без дублей, сбой батча с `confirmed`, очистка временных файлов, неизменность `Product`/`CatalogEntry`
- `tests/admin-catalog-update.test.ts` — переписан под новый клиент (один запрос, без worker и предпросмотра)
- `tests/admin-redesign.test.ts` — assertion про «не больше 256 МБ» остаётся валидным: текст сохраняется
- `nginx/nginx.conf`, `nginx/nginx-ssl.conf.example` — отдельный `location` для upload с `client_max_body_size 520m`
- `docs/engineering/catalog-updates.md` — описание предпросмотра и worker заменяется на серверный разбор
- `package.json` — `test:app`: убрать `tests/catalog-import.test.ts`, добавить `tests/catalog-upload.test.cjs`

## Contract change

Старый AC1 (`2026-11-14-admin-shared-catalog-update.md`) утверждал, что сырые файлы
не покидают устройство. Владелец решил отправлять их на сервер при сохранении.
Текст интерфейса «на сервер не отправляются» удаляется. Тест
`tests/catalog-import.test.ts` описывал клиентские батчи, которых больше нет, и
удаляется. Assertions `tests/admin-catalog-update.test.ts` про worker и предпросмотр
заменяются на assertions про один запрос и серверный маршрут.

## Risks and invariants

- Identity and scope: только ADMIN; сессия проверяется до чтения тела.
- Data preservation: только upsert по `barcode`, без удалений и замены базы.
- Server load: разбор 2 × 256 МиБ в памяти — главный риск; AC8 закрывает его замером.
  Событийный цикл Node блокируется на время разбора; пользователи других страниц
  могут заметить задержку во время загрузки каталога. Это принимается для редкой
  административной операции.
- Disk: временный файл до 520 МиБ в `os.tmpdir()`; на контейнере нужно место.
- Nginx: `client_max_body_size` меняет только новый `location`.
- Timezone, cron, notifications: не затрагиваются.
- Реальные DBF недоступны офлайн: проверка на синтетической паре на disposable SQLite.

## Verification plan

- AC1, AC4 → `tests/admin-catalog-update.test.ts` (один `fetch` на `catalog-upload`, нет worker); `tests/catalog-upload.test.cjs` (не-JSON ответ обрабатывается в компоненте по `Content-Type`)
- AC2 → `tests/catalog-upload.test.cjs` (неверная магия, длины, 413 при превышении)
- AC3, AC5 → `tests/catalog-upload.test.cjs` (синтетическая пара → счётчики; повтор → без дублей; сбой второго батча → `confirmed`)
- AC6 → `tests/catalog-upload.test.cjs` (401/403, временных файлов не остаётся)
- AC7 → `tests/catalog-upload.test.cjs` (счётчики `Product` и `CatalogEntry` не меняются)
- AC8 → замер локально (синтетика 443 701 строки), результат в Result; прод-подобный замер — SKIP до релизного окружения
- AC9 → `nginx -t` на обоих конфигах, если бинарник доступен; иначе SKIP с причиной

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context`
+ `npm run test:harness`, `npm run build`.

## Result and handoff

Pending implementation.
