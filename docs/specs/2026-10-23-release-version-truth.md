# The release marker must describe what is actually running

Status: APPROVED
Owner approval: Alex (owner), 2026-10-23, in chat: «давай исправляй все, выполняй эти пункты» (задача №2 — `.release-version`)
Type: ops
Branch: local/release-version-truth
Spec gate: `npm run check:spec`

## Что изменится для вас

Отчёт о деплое перестанет врать в одном конкретном случае: когда Docker собрал
новый образ, но старый контейнер не был пересоздан. Сейчас в такой ситуации
workflow пишет в файл-маркер новый коммит и потом «проверяет», сравнивая этот же
файл с тем, что сам в него записал, — проверка всегда зелёная. После исправления
проверка идёт от того, что реально работает в контейнере, и деплой с таким сбоем
упадёт и откатится, а не отрапортует «релиз вышел».

## Problem

`.github/workflows/deploy-production.yml` writes the marker in the deploy step,
right after `git checkout --detach` and **before** `docker compose build` /
`up -d`:

```yaml
git checkout --quiet --force --detach "$SHA"
# Recorded before the build so the health check can assert the promoted
# revision and a later rollback knows what was running.
printf '%s\n' "$SHA" > .release-version
docker compose build
docker compose up -d
```

`scripts/release-healthcheck.sh:72-79` then asserts `EXPECTED_REVISION` against
that same file:

```bash
ACTUAL="$(cat .release-version ...)"
[ "$ACTUAL" = "$EXPECTED" ] || fail "host is not running the expected revision"
```

Both values are written by the same workflow, so the assertion compares the
workflow's intention with the workflow's intention. It cannot notice a container
that still serves the previous build — the exact failure class it was written for
("the deploy appeared to work but the container is still serving the old build",
per the script's own header, lines 13-16).

The marker is not useless in that state: it still names the revision the host
intends to serve, which is what the rollback path reads
(`steps.previous.outputs.previous`). Its problem is that it is written before the
fact, and that the health check treats it as proof.

The marker lives on the host working tree and is rewritten by the next checkout;
`git check-ignore .release-version` confirms it stays out of Git.

## RED evidence

No test can produce a stale container offline, so the mechanism is recorded the
way `TEMPLATE--defect.md` allows: by the code path and a reproduced comparison.

```
$ grep -n "release-version" .github/workflows/deploy-production.yml
234:          printf '%s\n' "$SHA" > .release-version     # deploy step, before build
336:          printf '%s\n' "$PREV" > .release-version    # rollback step, before build
$ sed -n '72,79p' scripts/release-healthcheck.sh
echo "--- 2/4 promoted revision ---"
if [ -n "$EXPECTED" ]; then
  ACTUAL="$(cat .release-version 2>/dev/null | tr -d '\r' || echo '')"
  echo "expected=$EXPECTED actual=${ACTUAL:-<none>}"
  [ "$ACTUAL" = "$EXPECTED" ] || fail "host is not running the expected revision"
```

Reproduced on a scratch checkout of the repository:
`printf '%s\n' NEW-SHA > .release-version` with nothing rebuilt, then the same
comparison the script performs — `actual` equals `expected` and the check passes
while no container has been touched. That is the RED: the check cannot fail in
the situation it exists for.

## Acceptance criteria

- AC1 — the health check compares the expected revision with the revision the
  running application reports, not with a file the workflow wrote. The running
  revision is exposed by a protected endpoint (`/api/version`), read from the
  version marker baked into the image at build time; the assembly `/api/version`
  answers with no session, because deployment has none.
- AC2 — the marker is written **after** `docker compose up -d`, in the deploy step
  and in the rollback step, so it describes what was actually started.
- AC3 — the health check fails when the running application reports a different
  revision than expected, and the failure message names both; a missing or
  unreadable revision from the app counts as a failure, never a skip.
- AC4 — a dry run still deploys nothing and still exercises SSH, the workspace,
  `.env`, docker compose and the backup; it does not write the marker and does not
  require the new endpoint (the running release may predate it).

## Out of scope

- The deploy strategy itself: `docker compose up -d` is kept as the restart
  command. Making it `up -d --force-recreate` is a separate decision, and AC3 now
  makes its absence visible instead of silent.
- Image tagging by SHA, rollback orchestration, and the nginx/tunnel services.
- Whether `verify:release` should also read `/api/version` — the local release gate
  keeps its current checks.

## Files and signatures (draft)

- `src/pages/api/version.ts` — new route: `handler(req, res)` returning
  `{ revision: string }` for GET or HEAD; no session, no store scope, nothing but
  the baked marker
- `src/lib/server/revision.ts` — `readRunningRevision(): string` reading
  `.release-version` from the image working directory (`process.cwd()`), returning
  `"unknown"` when the file is missing or empty
- `Dockerfile` — build stage writes `.release-version` for the built revision
  (build argument `BUILD_REVISION`) and the runner stage copies it; the file ends
  up in the image, not in the mounted data directory
- `.github/workflows/deploy-production.yml` — pass `BUILD_REVISION` at build time,
  move both `printf … > .release-version` lines after `up -d`
- `scripts/release-healthcheck.sh` — step 2 reads the app's `/api/version` through
  `docker compose exec -T app` (same container, same reasoning as the database
  check) and compares it with `EXPECTED_REVISION`
- `scripts/deploy-workflow.mjs` — assert the new ordering (marker after `up -d`)
  and that the health check reads `/api/version`
- `tests/harness.test.mjs` — cases for both new assertions
- `tests/version-api.test.ts` — `readRunningRevision` and the handler
- `package.json` — `test:app` runs the new suite

## Contract change

`none` — no existing assertion is rewritten. The new `/api/version` route is
additive: no session, no department scope, no personal data, only the revision
string that already sits in `.release-version`.

## Risks and invariants

- `/api/version` must stay public but empty of anything else: a revision string is
  already visible in the deploy summaries; no build paths, no environment values.
- The marker inside the image must not be mistaken for the host marker: the host
  keeps its own copy for rollback, the app reads its own. Both are written from
  the same SHA.
- An older running release has no `/api/version`, so the check must report that as
  a failure of the release it judged, not crash the run: it already exits non-zero
  and triggers the rollback path.
- Nobody logs secrets: the endpoint returns only the revision.
- The 150-line `activeContext.md` cap and the deploy-workflow safety checks stay
  green.

## Verification plan

- AC1 → `tests/version-api.test.ts` (handler returns the baked revision, no session),
  `tests/harness.test.mjs` (the check must consult `/api/version`) and a run of the
  built route; end to end only during the next authorized deploy (last section)
- AC2 → `tests/harness.test.mjs`, «the release marker is written after the stack
  started»
- AC3 → `tests/version-api.test.ts`, `readRunningRevision` returns `unknown` for a
  missing file, and `tests/harness.test.mjs` asserts the failure message names both
  revisions
- AC4 → the workflow diff: the marker write and the `BUILD_REVISION` build happen
  in steps guarded by `dry_run == false`

Standing checks: `npm run typecheck`, `npm run test:app`,
`npm run check:context` + `npm run test:harness`, `npm run build`.

Not verifiable offline: the end-to-end deploy on the VPS. That needs a release,
which is a separate authorization; the spec closes with the local evidence and
names the remaining check.

## Result and handoff

Реализовано. `src/lib/server/revision.ts` читает `.release-version` из каталога
работающего образа (нет файла → `"unknown"`). `src/pages/api/version.ts` отвечает
`{ revision }` на GET/HEAD без сессии, `Cache-Control: no-store`, на прочие методы
`405`. `Dockerfile` получает `ARG BUILD_REVISION`, пишет маркер в build-стадии
(сначала удаляя возможный хостовый файл из контекста) и копирует его в runner.
`deploy-production.yml` собирает с `--build-arg BUILD_REVISION`, пишет хостовый
маркер **после** `up -d` — и в шаге деплоя, и в шаге отката.
`scripts/release-healthcheck.sh` шаг «4/5 running revision» спрашивает
`/api/version` внутри контейнера через `node -e fetch` (в образе нет curl),
`unreachable` — это отказ, а не пропуск.
`scripts/deploy-workflow.mjs` теперь проверяет порядок маркера, наличие
`BUILD_REVISION` и то, что health-check читает `/api/version`.

- AC1 → PASS — `tests/version-api.test.ts`: маркер `13ffef3…\n` → `readRunningRevision`
  даёт `13ffef3…`; обработчик отвечает `200` без сессии, `{ revision }`, `no-store`,
  POST → `405`. На собранном приложении: `.release-version` = `8d2ba19` →
  `{"code":200,"data":{"revision":"8d2ba19"},"cache":"no-store"}`, файл удалён →
  `{"revision":"unknown"}`.
- AC2 → PASS — `tests/harness.test.mjs`, «the release marker cannot stand in for the
  running revision»: возврат записи маркера до `up -d` ловится сообщением «writes
  .release-version before the stack started».
- AC3 → PASS — тот же набор: сборка без `BUILD_REVISION` ловится; health-check без
  `/api/version` ловится; `readRunningRevision` на отсутствующем и пустом файле даёт
  `unknown` (не бросает).
- AC4 → PASS — диф workflow: запись маркера и `BUILD_REVISION` живут только в
  шагах с `if: inputs.dry_run == false`; dry run их не выполняет.

Проверки: `npm run test:app` 117/117 PASS (114 + 3 новых), `npm run typecheck` PASS,
`npm run test:harness` 14/14 PASS, `npm run check:context` PASS, `npm run build`
PASS, `bash -n scripts/release-healthcheck.sh` — синтаксис OK.

Незакрытое:

- **Сквозной деплой на VPS не проверялся.** Нужен реальный релиз (`workflow_dispatch`
  + окружение `production`) — это отдельное разрешение владельца. До первого
  релиза с этим изменением работающий контейнер не знает `/api/version`, поэтому
  health-check нового workflow упадёт на шаге «running revision» и запустит откат.
  Порядок первого выката: старый workflow выкатывает коммит с кодом один раз
  (он не спрашивает `/api/version`), после этого новый workflow видит эндпоинт.
  Это ограничение записано здесь, чтобы его не пришлось выяснять на живой системе.
- `docker compose up -d` по-прежнему может не пересоздать контейнер, если этого не
  требуют изменения; теперь это видно, а не скрыто (см. Out of scope).
- `docker-entrypoint.sh` вызывает `npx tsx /app/scripts/ensure-admin.ts`, хотя
  Dockerfile переписывает эту строку через `sed`; в образе на Alpine, возможно,
  используется вариант без Node 22 `--experimental-strip-types`. Не проверялось,
  вне этой задачи.
