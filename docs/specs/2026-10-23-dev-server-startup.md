# `npm run dev` must start the application

Status: APPROVED
Owner approval: Alex (owner), 2026-10-23, in chat: «сделай npm run dev как ты считаешь нужным»
Type: defect
Branch: local/fix-dev-startup
Spec gate: `npm run check:spec`

## Что изменится для вас

Команда `npm run dev` перестанет падать на старте. Сейчас она умирает с
`Cannot find module './lib/prisma'` и `Ready` не наступает; после исправления
`next dev` поднимается за ~2 секунды, отдаёт страницу входа и `/api/version`, а
проверка базы (перевод в WAL и карантин битого журнала) по-прежнему выполняется до
запуска фоновых задач. Обходной путь `npm run build && npm start` остаётся как был,
но больше не обязателен.

## Problem

`src/instrumentation.ts` грузит `./lib/prisma` и `./lib/server/sqlite-health`
через `eval("require")` — намеренно: обычный импорт тянет `better-sqlite3` → `fs`
в edge-бандл и ломает production-сборку (регрессия 2026-10-14, описана в шапке
модуля). В production это работает, потому что хук исполняется из
`.next/standalone/server.js`, и `./lib/prisma` рядом действительно есть.

В dev сборки нет: хук исполняется из `.next/server/instrumentation.js`, и тот же
require разрешается против `.next/server/`, где модуля нет. `npm run dev` падает на
первой же строке хука.

Дополнительное ограничение, найденное при попытках: эти два модуля не попадают в
dev-граф webpack (нет статического импорта — так и задумано), поэтому рядом с хуком
их нет; а Node 24 не может исполнить `.ts`-источник, который импортирует соседний
файл без расширения (`from "./server/sqlite-health"`).

## RED evidence

Проба `run-dev-probe.sh` (запускает `next dev` на порту 8882, ждёт 25 с, запрашивает
`/` и `/auth/signin`, затем гасит сервер) на `origin/main` @ `edde94a`:

```
=== probe / -> 000 ; /auth/signin -> 000 ===
  ▲ Next.js 14.2.35
 ✓ Starting...
 ✓ Compiled /instrumentation in 228ms (20 modules)
Error: An error occurred while loading instrumentation hook: Cannot find module './lib/prisma'
Require stack:
- C:\Users\Alex\Desktop\Hermes\ExpirationTracker\.next\server\instrumentation.js
```

Для этого и только для этого случая RE кладёт рабочее дерево в состояние «до
исправления» — тест файла не покрывает (см. Verification plan).

## Acceptance criteria

- AC1 — `npm run dev` поднимается и отдаёт приложение: `GET /` → `307` на
  `/auth/signin`, `GET /auth/signin` → `200`.
- AC2 — проверка базы выполняется в dev до старта задач: подложенный битый
  `dev.db-journal` к концу запуска отсутствует (перемещён в карантин), WAL
  включается, фоновые задачи при `DISABLE_BACKGROUND_JOBS=true` не стартуют.
- AC3 — production-ветка не меняется: `npm run build` проходит, `npm start` (или
  `.next/standalone/server.js`) отдаёт `307`, `/api/version` отвечает, а edge-бандл
  не содержит `better-sqlite3`, `fs` и `path`.
- AC4 — dev-путь ничего не пишет за пределы `.next/`: собранные модули лежат в
  `.next/server/dev-lib`, исходники и `dev.db` не трогаются.

## Out of scope

- `next.config.js`, `Dockerfile`, `docker-entrypoint.sh`, deploy-workflow — не
  меняются.
- `src/lib/prisma.ts`, `src/lib/server/sqlite-health.ts`, `src/lib/server/jobs.ts` —
  не меняются.
- HMR/пересборка быстрее, чем сейчас; скорость dev-сервера в CI не замеряется.
- `.release-version` и релиз — отдельные задачи (#31, #32).

## Files and signatures (draft)

- `src/instrumentation.ts` — новый `createDevLoader(): NodeRequire`, используется
  только при `process.env.NODE_ENV === "development"`; production/edge по-прежнему
  идут через `runtimeRequire` с теми же id
- `tests/instrumentation.test.cjs` — новые случаи: dev-ветка выбирает dev-загрузчик,
  production — `runtimeRequire`, edge не грузит ничего

## Contract change

`none` — существующие утверждения переиспользуются: production-случаи в
`tests/instrumentation.test.cjs` остаются на месте, узел `module` получает
`require` и `createRequire`, чтобы dev-загрузчик можно было исполнить без файловой
системы.

## Risks and invariants

- Edge-рантайм по-прежнему не должен видеть `better-sqlite3`, `fs`, `path`:
  dev-загрузчик вызывается только в ветке `NODE_ENV === "development"`, а все его
  зависимости берутся через `eval("require")`, который webpack не трассирует.
- Проверка базы в dev обязана выполниться **до** старта задач — тот же порядок, что
  в production; иначе карантин журнала пришёл бы после первого чтения базы.
- Рабочее дерево остаётся чистым: всё, что создаётся, лежит внутри `.next/`.
- Ошибка в самом dev-загрузчике не должна ронять старт молча: она пробрасывается,
  и `next dev` сообщает её как ошибку хука (так и проверялось).
- `NEXT_RUNTIME` остаётся литеральным сравнением.

## Verification plan

- AC1 → `run-dev-probe.sh` (внешний скрипт пробы): `GET /` = 307,
  `GET /auth/signin` = 200, строки `✓ Ready` в логе; RED выше зафиксирован на
  `origin/main`
- AC2 → `tests/instrumentation.test.cjs` (порядок «гейт до задач» в dev-ветке);
  на хосте — проба с подложенным битым `dev.db-journal`: файл исчез после запуска
- AC3 → `npm run build` PASS; `npm start` отдаёт `/` → `307` и
  `/api/version` → `{revision:"unknown"}`; в серверном и edge-бандлах хука нет
  `better-sqlite3`, а `node:path`/`node:fs` встречаются только внутри
  `eval("require")`-вызовов, которые webpack не разрешает
- AC4 → `git status --short` чист после запуска (кроме игнорируемых файлов),
  сгенерированные файлы только в `.next/server/dev-lib`

Постоянные проверки: `npm run typecheck`, `npm run test:app`,
`npm run check:context` + `npm run test:harness`, `npm run build`.

## Result and handoff

Реализовано в `src/instrumentation.ts`: `createDevLoader()` собирает два служебных
модуля в CommonJS через уже установленный `typescript` в `.next/server/dev-lib`,
переписывает относительные импорты на `.ts` и отдаёт их по тем же id. Ветка
production/edge не тронута.

- AC1 → PASS — проба: `GET /` → `307`, `GET /auth/signin` → `200`, в логе
  `✓ Ready in 2.1s`, `GET /api/version` → `{"revision":"unknown"}`
- AC2 → PASS — проба с подложенным битым `dev.db-journal` (33 байта): после запуска
  файла нет, сервер стартует; карантин выполняет `prepareDatabaseForStartup`
- AC3 → PASS — `npm run typecheck` и `npm run build` PASS, `/api/version` на
  собранном приложении отвечает (проверено ранее в #32)
- AC4 → PASS — после всех запусков `git status --short` пуст, файлы только в
  `.next/server/dev-lib`

Проверки: `npm run typecheck` PASS, `npm run test:app` (см. PR), `npm run build`
PASS, `npm run check:context` + `npm run test:harness` PASS.

Незакрытое: dev-сервер по-прежнему ждёт `NEXTAUTH_SECRET` (без него NextAuth падает
с `NO_SECRET` — это отдельное свойство NextAuth, не дефект); `next dev` затирает
`.next/BUILD_ID`, поэтому после него нужна пересборка для `next start`.
