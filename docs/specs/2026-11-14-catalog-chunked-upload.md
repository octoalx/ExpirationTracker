# Shared catalog: upload the DBF pair in chunks

Status: APPROVED
Owner approval: Алекс, 14.11.2026, в чате: «Все твои решения, предложенные на пути, да, так и сделать.» (все решения D1–D10, решения по трём открытым пунктам: nginx-location входит в эту задачу, старый эндпоинт удаляется, риск памяти измеряется в AC12)
Type: contract
Branch: claude/catalog-chunked-upload
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner approves
this file. Until then no code and no test edits. Supersedes D1 and AC1 of
`docs/specs/2026-11-14-catalog-server-side-import.md` ("one request carries both files").

## Что изменится для вас

Вы выбираете `goods.dbf` и `barcode.dbf` и нажимаете «Сохранить каталог». Файлы
автоматически режутся на части по 90 МБ и уходят на сервер по очереди, поэтому
загрузка проходит даже через Cloudflare с лимитом 100 МБ на запрос. Во время
загрузки виден прогресс «отправлено N из M МБ». Если связь оборвалась, повторная
загрузка продолжается с места обрыва, а каталог не меняется, пока все части не
получены и файлы не разобраны.

## Problem

Пара файлов около 230 МБ в одном запросе отклоняется Cloudflare с ответом 413
(`text/html`, заголовок `server: cloudflare`, `cf-ray` на скриншоте владельца от
14.11.2026). Запрос до nginx и приложения не доходит, поэтому лимит `client_max_body_size`
в `nginx/` не помогает. По результатам поиска по документации Cloudflare лимит тела
запроса 100 МБ на Free и Pro, 200 МБ на Business, 500 МБ на Enterprise; точный лимит
аккаунта владельца не проверен. Куски по 90 МБ укладываются в 100 МБ при любом тарифе.

## Decisions

- D1. Тело загрузки остаётся прежним: заголовок `ECATDBF1` + длины + `goods.dbf` +
  `barcode.dbf`, собирается `buildCatalogUploadBody` как `Blob`. Браузер режет его по
  смещению `blob.slice(offset, offset + CHUNK_BYTES)`, структуру DBF не читает.
- D2. `CHUNK_BYTES = 90 * 1024 * 1024`. Куски отправляются строго по одному.
- D3. Протокол из трёх шагов:
  `POST /api/admin/catalog-upload/init` (JSON `{ totalBytes }`) → `uploadId`;
  `PUT /api/admin/catalog-upload/chunk?uploadId=…&offset=…` (тело до 90 МБ,
  `application/octet-stream`);
  `GET /api/admin/catalog-upload/status?uploadId=…` (полученные диапазоны);
  `POST /api/admin/catalog-upload/finalize?uploadId=…` (разбор и импорт).
- D4. Сервер пишет каждый кусок в `os.tmpdir()/catalog-upload-<uploadId>.bin` через
  `handle.write(buffer, 0, length, offset)`, не держа тело в памяти. Повтор того же
  куска перезаписывает те же байты и безопасен.
- D5. Состояние загрузки (`uploadId`, `totalBytes`, полученные диапазоны, время
  последнего действия) хранится в sidecar-файле `catalog-upload-<uploadId>.json`
  рядом с бинарным файлом. Прогресс переживает перезапуск процесса. Схема Prisma не меняется.
- D6. Один активный `uploadId` на администратора. Новый `init` отменяет незавершённый
  предыдущий и удаляет его временные файлы.
- D7. `finalize` проверяет, что все байты `[0, totalBytes)` получены, затем вызывает
  существующий `importCatalogUpload` с потоком из временного файла
  (`fs.createReadStream`). Батчи по 500 и upsert по `barcode` не меняются.
- D8. Временный файл удаляется после успешного импорта или после TTL 24 часа без
  активности. Очистка идемпотентна и запускается при старте и при каждом `init`.
- D9. Лимиты сохраняются: каждый DBF не больше 256 МиБ, суммарно не больше 512 МиБ
  плюс заголовок, `totalBytes` проверяется по заголовку через `readFrame`.
- D10. Все четыре эндпоинта требуют сессию ADMIN до чтения тела, как сейчас.

## Acceptance criteria

- AC1 — при выборе двух файлов клиент делает `init`, затем последовательно `chunk`
  по 90 МБ, затем `finalize`; один запрос с телом больше 90 МБ не отправляется. Проверка:
  unit-тест нарезки и тест клиента с подменённым `fetch`.
- AC2 — `init` с неверным заголовком, несовпадением длин или размером больше лимита
  отклоняется с русским сообщением, временный файл не создаётся.
- AC3 — `chunk` с `offset` вне диапазона или длиной сверх `totalBytes` отклоняется
  400 и не меняет файл.
- AC4 — повтор `chunk` с тем же `offset` не создаёт дублей и не портит файл; `status`
  показывает уже полученные диапазоны.
- AC5 — `finalize` до получения всех байт возвращает 409 с списком недостающих диапазонов
  и не трогает каталог.
- AC6 — после полной загрузки `finalize` разбирает пару и пишет записи батчами по 500;
  ответ содержит `imported` и счётчики разбора, как сейчас.
- AC7 — сбой записи батча после `finalize` возвращает `confirmed` (число подтверждённых
  записей); повторный `finalize` с тем же `uploadId` не создаёт дублей.
- AC8 — `chunk`, `status`, `finalize`, `init` без сессии возвращают 401, для не-ADMIN — 403;
  тело не читается до проверки прав.
- AC9 — временные файлы (`.bin` и `.json`) удаляются после успеха, после ошибки
  `finalize` при явной отмене и по TTL; `init` удаляет предыдущий незавершённый upload (D6).
- AC10 — личные данные (`Product`) не читаются и не меняются; схема Prisma и миграции не
  меняются.
- AC11 — на клиенте виден прогресс по байтам и кнопка повтора после обрыва; повтор
  продолжает с недостающих кусков, а не с начала. Проверка: ручной walk-through в браузере
  с файлами 230 МБ на dev-сервере (SKIP, если не выполнено, с указанием причины).
- AC12 — синтетическая пара 230 МБ проходит end-to-end на disposable SQLite через
  тестовый клиент; замер времени и пиковой памяти записан в Result.

## Out of scope

- Изменения `docker-compose.yml` и сетевой схемы (порт, туннель). Изменение `nginx/`
  ограничено отдельным `location` для путей chunked-загрузки (см. Files and Risks).
- Изменения лимитов Cloudflare, тарифа или DNS.
- Фоновый импорт с опросом статуса (D4 предыдущей спеки сохраняется: запрос открыт до конца).
- Удаление старого `POST /api/admin/catalog`, миграции и схема Prisma.
- Развёртывание на прод и реальный импорт; `deploy.sh` не запускается.

## Files and signatures (draft)

- `src/lib/catalog-upload-format.ts` — `CHUNK_BYTES`, `buildCatalogUploadBody` без изменения формата
- `src/lib/server/catalog-upload-chunks.ts` (новый) — `initUpload(admin, totalBytes)`,
  `writeChunk(uploadId, offset, stream)`, `getStatus(uploadId)`, `finalizeUpload(uploadId, prisma)`,
  `cleanupStaleUploads(now)`
- `src/lib/server/catalog-upload.ts` — `importCatalogUpload` принимает файл-путь или `Readable`
  (`importCatalogUploadFile(path, prisma)`); логика батчей не меняется
- `src/pages/api/admin/catalog-upload/init.ts` — `POST`, JSON
- `src/pages/api/admin/catalog-upload/chunk.ts` — `PUT`, `config.api.bodyParser: false`
- `src/pages/api/admin/catalog-upload/status.ts` — `GET`
- `src/pages/api/admin/catalog-upload/finalize.ts` — `POST`
- `src/pages/api/admin/catalog-upload.ts` — удаляется или оставляется как 410 с текстом «используйте chunked»
  (решение владельца, по умолчанию удалить)
- `src/components/CatalogImport.tsx` — нарезка, прогресс, повтор
- `tests/catalog-upload-chunks.test.cjs` (новый) — AC2–AC9, AC12
- `tests/admin-catalog-update.test.ts` — переписан под протокол из трёх шагов (AC1)
- `nginx/nginx.conf`, `nginx/nginx-ssl.conf.example` — `location` для префикса
  `/api/admin/catalog-upload/` с `client_max_body_size 100m`, без изменения общего `location /`
- `tests/catalog-upload.test.cjs` — старый тест маршрута `catalog-upload.ts` удаляется; тесты библиотеки `importCatalogUpload` остаются
- `package.json` — `test:app`: добавить `tests/catalog-upload-chunks.test.cjs`
- `docs/engineering/catalog-updates.md` — описание протокола

## Contract change

Старый D1 и AC1 спеки `2026-11-14-catalog-server-side-import.md` говорили «один запрос
с обоими файлами». Это неверно при лимите 100 МБ на запрос у Cloudflare Free и Pro.
Тесты `tests/admin-catalog-update.test.ts` и `tests/catalog-upload.test.cjs`, которые
проверяют один `fetch` на `/api/admin/catalog-upload`, меняются на протокол из трёх
шагов. Эндпоинт `POST /api/admin/catalog-upload` удаляется (или отвечает 410), поэтому
его тесты удаляются вместе с ним.

## Risks and invariants

- Identity and scope: все эндпоинты только для ADMIN; сессия до чтения тела.
- Data preservation: upsert по `barcode`, без удалений; временные файлы не попадают в БД.
- Server load: куски пишутся на диск потоком, пиковая память не растёт с размером файла,
  кроме разбора. Разбор 230 МБ уже измерен в спеке предыдущей задачи: 912 МБ RSS на 443 701
  строке; на проде 1.9 ГБ RAM. Риск сохраняется, AC12 его измеряет.
- Disk: нужно около 230 МБ временного места плюс `.json`-состояние. Проверить на проде перед
  использованием.
- Concurrency: одновременные `chunk` для одного `uploadId` сериализуются записью по `offset`;
  два `finalize` одновременно не выполняются (блокировка по `uploadId`).
- Timezone, cron, notifications: не затрагиваются.
- Nginx: старый `location = /api/admin/catalog-upload` удаляется вместе с эндпоинтом;
  новый `location ^~ /api/admin/catalog-upload/` задаёт `client_max_body_size 100m`
  (куски 90 МБ + запас). Общий `location /` с лимитом 1 МБ не меняется.

## Verification plan

- AC1 → `tests/admin-catalog-update.test.ts`, asserts 3-шаговый протокол, куски по 90 МБ
- AC2 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC3 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC4 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC5 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC6 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC7 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC8 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite, маршруты 405/401/403 без чтения тела
- AC9 → `tests/catalog-upload-chunks.test.cjs` на disposable SQLite
- AC10 → `tests/catalog-upload-chunks.test.cjs`, счётчики `Product` не меняются
- AC11 → manual: dev-сервер, администратор, пара 230 МБ, обрыв сети на середине → повтор
  продолжает с недостающих кусков (SKIP, если не выполнено)
- AC12 → synthetic 230 МБ через тестовый клиент, замер в Result

Standing checks: `npm run typecheck`, `npm run test:app`, `npm run check:context`
+ `npm run test:harness`, `npm run build`.

## Result and handoff

Checked 14.11.2026 on Node 22 with a disposable SQLite (every migration applied).

- AC1 → PASS — `tests/catalog-upload-chunks.test.cjs` (planChunks: 90 MiB parts, last part shorter); `tests/admin-catalog-update.test.ts` (init/chunk/status/finalize, one fetch per part)
- AC2 → PASS — chunks test: wrong magic, length mismatch and oversize refused by init with 400/413; no file created
- AC3 → PASS — chunks test: part past the end and truncated part refused with 400
- AC4 → PASS — chunks test: the same part sent twice; status lists merged ranges; file completes correctly
- AC5 → PASS — chunks test: finalize with gaps answers 409 with the missing range and makes zero writes
- AC6 → PASS — chunks test: 1,010-row pair imported in batches, counts returned; route cycle test returns 200 with imported = 4
- AC7 → PASS — chunks test: second batch fails → confirmed 500; repeat finalize converges to 1,010 rows with no duplicates
- AC8 → PASS — route test: 405, 401 and 403 with `readableDidRead === false` (body not read before the session check); ADMIN completes the cycle
- AC9 → PARTIAL — temporary files removed after success (AC6 check) and by TTL on init/cleanup (D8 test); init replaces the previous upload (D6 test). Not done: an explicit cancel endpoint (none was specified in the routes list) and cleanup on process start (D8 says "при старте": only the init path runs it)
- AC10 → PARTIAL — schema and migrations unchanged. The Product check only shows the count stays 0, because the fixture seeds no products; it does not prove that existing rows survive. Not verified with seeded products
- AC11 → SKIP — no browser walk-through with 230 MB files on a dev server was run
- AC12 → PASS (measured, memory risk open) — synthetic pair 232.7 MB (205 MB goods, 27.7 MB barcode, 1,000,000 rows) via the chunk protocol: 1,000,000 rows imported, finalize 41.2 s, finalize peak RSS 1,743 MB (sampled, source buffers released). The production host has 1.9 GB RAM shared with the app, so the margin is small. This remains an open risk, as in the previous spec's AC8

Commands: `npm run typecheck` exit 0; `npm run test:app` 199/199; `npm run test:harness` 14/14; `npm run check:context` PASS (150 lines); `npm run build` OK, the four new routes are in the bundle.

Limitations: AC9 cancel and startup cleanup, AC10 with seeded products, AC11 browser run, and production memory are open. nginx `location ^~ /api/admin/catalog-upload/` with 100 MB was checked by reading the config only: `nginx -t` is not available in this container. The deployed nginx and Cloudflare plan must be checked before a real upload.
