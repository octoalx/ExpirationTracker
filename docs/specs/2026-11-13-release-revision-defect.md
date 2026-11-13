# Дефект: образ собирается со старым номером ревизии, деплой откатывается

Status: APPROVED
Owner approval: Алекс, 13.11.2026, в чате: «Сделай деплой на сервер» (деплой запущен, упал на этой ошибке)
Type: defect
Branch: local/deploy-revision-fix
Spec gate: `npm run check:spec`

## Что изменится для вас

Выпуск перестанет откатываться на середине: контейнер будет сообщать ту ревизию, которую в него собрали, а не предыдущую. Признак исправления — запуск `deploy-production.yml` доходит до шага «Health check the deployed revision» зелёным, а `/api/version` на сервере отдаёт новый хеш.

## Problem

Запуск `43496722442` (13.11.2026, 19:55) собрал образ из `1a1a362`, контейнер поднялся здоровым, но `GET /api/version` вернул `6c9938e` — ревизию предыдущего выпуска. Проверка здоровья сравнила это с ожидаемым `1a1a362`, упала, и откат вернул старую сборку; шаг отката тоже не прошёл проверку, поэтому запуск завершился с «Rollback failed; manual intervention required».

Механизм: в `Dockerfile` строка `RUN rm -f .release-version && printf '%s\n' "$BUILD_REVISION" > .release-version` стоит **до** `COPY . .` (строки 23–24). Аргумент сборки записывает новую ревизию, а следующая строка копирует контекст целиком и перезаписывает файл копией с хоста, где лежит `.release-version` предыдущего выпуска. В `.dockerignore` этого файла нет, поэтому он попадает в образ. Итог: образ всегда сообщает ревизию, которая была на хосте до сборки, то есть ровно на один выпуск назад.

Введено коммитом `abb76ef` (2026-10-23, спека `2026-10-23-release-version-truth`): тогда проверка здоровья начала спрашивать контейнер вместо маркера, но файл продолжал попадать в сборку через `COPY . .`. На первом выпуске после этой правки хостовый маркер совпал с ожидаемым по случайности, поэтому дефект не проявился до сегодня.

## RED evidence

- `ssh cloudvps 'curl -s http://localhost:8881/api/version'` → `{"revision":"6c9938e675cf48a2e4a1dab945438a66acf67cef"}`, при `git log -1` на хосте `1a1a362` и `.release-version` = `1a1a362`.
- Внутри контейнера: `docker exec expirationtracker-app-1 cat .release-version` → `6c9938e...`.
- Лог шага: `HEALTHCHECK FAILED: the application reports revision '6c9938e…' while the promoted revision is '1a1a362…'`.

## Acceptance criteria

- AC1 — `.dockerignore` содержит `.release-version`, а запись ревизии в `Dockerfile` выполняется после `COPY . .`; в собранном образе `.release-version` равен значению `BUILD_REVISION`, переданному сборке, при любом содержимом файла на хосте.
- AC2 — проверка воспроизводится локально без Docker: тест читает `Dockerfile` и `.dockerignore` и падает, если строка с `BUILD_REVISION` стоит раньше последнего `COPY . .` в стадии `builder`, или если `.release-version` не исключён из контекста.
- AC3 — повторный запуск `deploy-production.yml` на ревизии с исправлением доходит до «Health check the deployed revision» и завершается успешно; `/api/version` на сервере отдаёт эту ревизию.
- AC4 — `npm run typecheck`, `npm run test:app`, `npm run build` зелёные.

## Out of scope

- Изменение последовательности шагов workflow (backup → deploy → health → rollback) и текста отчётов.
- Пересборка предыдущих выпусков и любые действия с базой.

## Files and signatures (draft)

- `Dockerfile`
- `.dockerignore`
- `tests/release-revision-build.test.ts` — новый набор на порядок строк и исключение файла
- `package.json` — регистрация набора в `test:app`

## Contract change

none

## Risks and invariants

- Сборка: перенос строки не меняет набор слоёв, только порядок; кеш слоёв после `COPY . .` инвалидируется один раз.
- Выпуск: после исправления проверка здоровья становится настоящей — образ сообщает собственную ревизию; откат остаётся прежним.
- Данные: дефект не касался базы; снимок `expitrack-pre-deploy-20261113T195540Z-1a1a36279cbf.db` снят перед упавшим выпуском.

## Verification plan

- AC1 → `tests/release-revision-build.test.ts` проверяет порядок строк и `.dockerignore`
- AC2 → тот же тест, падает на текущем `Dockerfile` до правки (RED), проходит после
- AC3 → `gh run view` запуска `deploy-production.yml` и `curl -s https://expiry.axnode.xyz/api/version` (через `ssh cloudvps curl http://localhost:8881/api/version`)
- AC4 → команды

## Result and handoff

- AC1 → PASS. `.dockerignore` исключает `.release-version`, запись ревизии идёт после `COPY . .`; образ выпуска `d0b701e` сообщает `d0b701e` (было: `6c9938e` при хосте на `1a1a362`).
- AC2 → PASS. `tests/release-revision-build.test.ts`: на старом `Dockerfile` — 1 падение (RED), после правки — 3/3 pass; набор зарегистрирован в `test:app`.
- AC3 → PASS. Запуск `43500090396` (`deploy-production.yml`, ref `d0b701e`) — все шаги зелёные, включая «Health check the deployed revision»; `ssh cloudvps curl http://localhost:8881/api/version` → `{"revision":"d0b701e90dacfd42fd50d1c57d8dcdf7eacc303e"}`; `.release-version` на хосте совпадает; контейнер `Up (healthy)`; публичный адрес отвечает 302 (Cloudflare Access, ожидаемо).
- AC4 → PASS. `npm run typecheck` — 0 ошибок; `npm run test:app` — 173 теста, 173 pass; `npm run build` — успешно.

Ограничения: первый запуск (`43496722442`) упал на этом дефекте и вернул старую сборку; база не пострадала, снимок `expitrack-pre-deploy-20261113T195540Z-1a1a36279cbf.db` лежит в `backups/`. Проверка «изнутри контейнера по страницам» не делалась: все маршруты за авторизацией отдают 307.
