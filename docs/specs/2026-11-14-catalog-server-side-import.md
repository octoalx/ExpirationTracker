# Shared catalog: upload the DBF pair to the server on save

Status: DRAFT
Owner approval:
Type: contract
Branch: claude/catalog-server-side-import (fresh from origin/main when approved)
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves this file. Until then no code and no test edits.

Supersedes AC1 of `docs/specs/2026-11-14-admin-shared-catalog-update.md` ("raw files
are never sent to the server"). That rule is removed by this spec's Contract change.

## Что изменится для вас

Вы выбираете `goods.dbf` и `barcode.dbf` и нажимаете «Сохранить каталог». Файлы
загружаются на сервер, там разбираются и записываются в общий каталог; на экране
появляется итог («загружено N товаров») или понятная ошибка. Ошибка сети или
«Unexpected token '<'» больше не должна появляться: при любом сбое вы увидите код
ответа и текст, что делать дальше.

## Problem

Сейчас браузер разбирает DBF и отправляет `/api/admin/catalog` батчами по 500 записей
(`src/components/CatalogImport.tsx`, `src/lib/catalog-import.ts`). Наблюдаемый
сбой: при записи ~132 500 из 443 701 появляется `Unexpected token '<', "<!DOCTYPE"…`.
Это значит, что `response.json()` получил HTML-страницу вместо JSON, а код не
проверяет статус и тип ответа (`CatalogImport.tsx:65`). Причина HTML на сервере не
подтверждена: в `nginx/nginx.conf` нет `client_max_body_size` (по умолчанию 1 МБ)
и нет отдельного блока для `/api/admin/catalog`. Логи за момент сбоя ещё не изучены.
Один долгий запрос на каждый батч — лишь одна из возможных причин, но сама схема
(сотни запросов с клиента) делает сбой вероятным.

## Acceptance criteria

- AC1 — кнопка «Сохранить каталог» отправляет оба выбранных файла на сервер одним
  действием; браузер не разбирает DBF для сохранения.
- AC2 — сервер принимает файлы до 256 МиБ каждый; больший размер отклоняется с
  русским сообщением и не записывает ни одной строки.
- AC3 — сервер разбирает пару тем же парсером (`src/lib/catalog-dbf.ts`), проверяет
  её, пишет в `SharedCatalogEntry` батчами по 500 в отдельных транзакциях и
  возвращает JSON с числом записанных строк.
- AC4 — на любой ошибке (HTTP 4xx/5xx, HTML-ответ, обрыв сети) интерфейс показывает
  код ответа и текст на русском; `response.json()` вызывается только после проверки
  `Content-Type: application/json`.
- AC5 — повторная загрузка той же пары не создаёт дублей; частично записанные
  батчи остаются, и итог сообщает, сколько записей подтверждено.
- AC6 — `POST` без сессии возвращает 401, для не-ADMIN — 403; тело запроса не
  читается до проверки прав; временные файлы удаляются в `finally` в любом исходе.
- AC7 — личные `Product` и `CatalogEntry` не читаются и не меняются.
- AC8 — перед релизом измерены время и пиковая память одной загрузки 443 701
  строки на машине, сопоставимой с продовой (2 ядра, 1.9 ГБ RAM), с результатом в
  Result. Если пик превышает свободную память с учётом работающего Next.js, пункт
  остаётся открытым, и владелец решает, что делать.

## Out of scope

- Фоновые задания с опросом статуса (отдельная спека, если AC8 покажет риск).
- Предпросмотр примеров до записи: решение владельца, см. Open decisions.
- Изменения схемы Prisma и миграции.
- Развёртывание на продакшн; `deploy.sh` и реальный импорт не запускаются.
- Удаление личного `POST /api/catalog` (отдельная задача).

## Open decisions (owner)

1. Сохранить ли проверку «Проверить файлы» с предпросмотром до записи? Если да,
   браузер или второй запрос сервера разбирает пару дважды. Черновик предполагает
   убрать предпросмотр и показывать итог после записи.
2. Допустимо ли держать HTTP-запрос открытым до конца записи (несколько минут на
   443 701 строке), или нужен фоновый режим с опросом статуса?

## Files and signatures (draft)

- `src/components/CatalogImport.tsx` — выбор файлов, один запрос на сохранение,
  проверка статуса и типа ответа, текст ошибок на русском
- `src/pages/api/admin/catalog-upload.ts` — `POST`, `config.api.bodyParser: false`,
  потоковая запись в каталог временных файлов, ответ JSON
- `src/lib/server/catalog-upload.ts` — `importCatalogPair(goodsPath, barcodePath): Promise<{ imported: number }>`
- `src/lib/catalog-import.ts` — батчи по 500 переходят на сервер (клиентская версия удаляется)
- `src/lib/catalog-dbf.worker.ts` — удаляется, если предпросмотр убран (решение 1)
- `nginx/nginx.conf`, `nginx/nginx-ssl.conf.example` — `client_max_body_size 300m;` для
  маршрута загрузки; без изменения `proxy_read_timeout`
- `tests/catalog-upload.test.cjs` — новый: 401/403, 413, пара → счётчики, повтор без дублей,
  частичный сбой, удаление временных файлов
- `tests/admin-catalog-update.test.ts` — обновляется под новую схему клиента
- `tests/admin-redesign.test.ts` — assertion про текст сохранения обновляется, если
  текст меняется
- `package.json` — новый набор в `test:app`

## Contract change

Старый AC1 (`2026-11-14-admin-shared-catalog-update.md`) утверждал, что сырые файлы
не покидают устройство. Владелец решил отправлять их на сервер при сохранении.
Текст интерфейса «на сервер не отправляются» удаляется. Тесты, которые проверяют
клиентский батчинг (`tests/admin-catalog-update.test.ts`, `tests/catalog-import.test.ts`),
меняются вместе с кодом: они описывают путь, который больше не существует.

## Risks and invariants

- Identity and scope: только ADMIN; проверка сессии до чтения тела запроса.
- Data preservation: только upsert по `barcode`, без удалений и замены базы.
  Файлы не сохраняются на постоянный диск; временная директория очищается.
- Server load: 256 МиБ × 2 в памяти в худшем случае на 1.9 ГБ RAM — основной риск,
  закрывается AC8. Записи идут последовательными транзакциями по 500.
- Nginx: `client_max_body_size` меняет общий конфиг; на сервере нужно проверить,
  что используется именно `nginx/nginx.conf`, а не отдельный файл.
- Timezone, cron, notifications: не затрагиваются.
- Реальные DBF недоступны офлайн: проверка на синтетической паре на disposable SQLite.

## Verification plan

- AC1, AC4 → `tests/catalog-upload.test.cjs` (ответ не JSON → текст с кодом); browser walk-through с синтетической парой
- AC2 → тест 413 на файле больше лимита
- AC3, AC5 → тест на 1 200 записей: 3 транзакции, итог 1 200; повтор → без дублей
- AC6 → тест 401/403, файлы не создаются
- AC7 → тест: счётчики `Product` и `CatalogEntry` не меняются
- AC8 → замер на сопоставимой машине, результат в Result; без замера — SKIP

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context`
+ `npm run test:harness`, `npm run build`, `nginx -t` на сконфигурированном образе
(если доступен), browser walk-through на disposable базе.

## Result and handoff

Not started. Spec is DRAFT.
