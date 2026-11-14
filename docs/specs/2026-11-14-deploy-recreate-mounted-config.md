# Deploy workflow does not pick up changes to mounted config files

Status: APPROVED
Owner approval: Alex, 2026-11-14, chat ("APPROVED")
Type: defect
Branch: local/deploy-recreate-mounted-config
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves. Until then no code and no test edits: the spec is the only file that may
be committed. See `docs/engineering/workflow.md`.

## Что изменится для вас

Деплой из GitHub Actions будет пересоздавать `nginx`-контейнер на каждом релизе,
а не только когда меняется его образ. Правка `nginx.conf` (или любого другого
смонтированного конфигурационного файла) заработает сразу после следующего
деплоя — без ручного SSH и `docker compose up -d --force-recreate nginx`, как
пришлось делать 2026-11-14 вручную.

## Problem

`docker compose up -d` recreates a service only when Compose detects its
resolved config (image, env, command, ports, …) changed. `nginx` builds from the
unmodified `nginx:alpine` image and its only per-deploy change is the content of
a bind-mounted file (`./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`). A bind mount
of a single file pins the container to the inode that existed when the container
was created; when `git checkout`/`git merge` on the host replaces that file with
a new inode (the normal way Git updates a file), the already-running `nginx`
process keeps reading the old inode's content. `docker compose up -d` does not
notice anything changed, so it leaves the stale container running, and
`nginx -s reload` re-reads the same stale bind target — only
`docker compose up -d --force-recreate nginx` re-binds the mount to the current
file.

This is exactly what happened: PR #45 (`claude/catalog-chunked-upload`, merged as
`bff09d2`) added a `location ^~ /api/admin/catalog-upload/ { client_max_body_size
100m; ... }` block to `nginx/nginx.conf`. The GitHub Actions deploy job
(`.github/workflows/deploy-production.yml`, steps "Deploy the revision" at
lines 236-237 and "Roll back to the previous revision" at lines 340-341) ran
`docker compose build --build-arg BUILD_REVISION=... && docker compose up -d`
for this merge. `app`'s image hash changed, so `app` was recreated; `nginx`'s
image and declared config did not change, so Compose left the existing `nginx`
container running on the inode from its last recreation (2026-11-13 23:03,
before the merge). The default body limit (1 MB) then rejected the chunked
catalog upload at 90 MB with HTTP 413, observed by the owner as an endless
loading spinner (a separate front-end defect: the client does not surface a
413, out of scope here). Confirmed live on 2026-11-14 via
`docker exec expirationtracker-nginx-1 md5sum /etc/nginx/nginx.conf` (stale,
61 lines) differing from `/home/Alex/ExpirationTracker/nginx/nginx.conf`
(current, 75 lines); `docker compose up -d --force-recreate nginx` fixed it
on the spot, verified with a 90 MB `PUT` returning 302 (auth redirect) instead
of 413.

The manual `deploy.sh` does not have this defect: step `[1/4]` runs
`docker compose down --remove-orphans` before `up -d`, which always tears down
and recreates every container, nginx included. Only the GitHub Actions path
(the one actually used for production per `AGENTS.md`) is missing the
equivalent recreation and is therefore the one that needs the fix.

## RED evidence

This is an infrastructure/ops defect in a deploy script, not application
behaviour covered by `npm run test:app`; there is no unit test harness for the
GitHub Actions workflow's remote shell steps. The reproduced defect and its
live fix are the RED/GREEN evidence:

```
# RED (before the fix, live production, 2026-11-14 14:31 UTC, nginx access log)
172.20.0.2 - - [14/Nov/2026:14:31:12] "PUT /api/admin/catalog-upload/chunk?...offset=0" 413 585
2026/11/14 14:31:12 [error] client intended to send too large body: 94371840 bytes

# cause confirmed
$ docker exec expirationtracker-nginx-1 md5sum /etc/nginx/nginx.conf
e5afa72b2e3477ac668aff39e2f65771  /etc/nginx/nginx.conf
$ md5sum /home/Alex/ExpirationTracker/nginx/nginx.conf
c2a47be71a2893e459ff8e22fa0af25c  /home/Alex/ExpirationTracker/nginx/nginx.conf

# GREEN (manual workaround, same session)
$ docker compose up -d --force-recreate nginx
$ docker exec expirationtracker-nginx-1 md5sum /etc/nginx/nginx.conf
c2a47be71a2893e459ff8e22fa0af25c  /etc/nginx/nginx.conf   # now matches
$ curl -X PUT .../chunk?... -T probe-90mb.bin   -> HTTP 302 (no longer 413)
```

This spec's AC1 is verified by inspecting the changed workflow file and, when
the owner next runs a real deploy, confirming the step recreates `nginx`
unconditionally (`docker inspect nginx --format '{{.State.StartedAt}}'` moves
forward even when only `nginx.conf` changed).

## Acceptance criteria

- AC1 — the "Deploy the revision" step always recreates the `nginx` service
  (and any other service that only bind-mounts config, never builds), so a
  config-only change to a mounted file takes effect on the next deploy without
  manual SSH intervention.
- AC2 — the "Roll back to the previous revision" step has the identical fix,
  so a rollback also re-binds mounted config instead of only touching `app`.
- AC3 — `app`'s existing recreate-on-image-change behaviour is unchanged (no
  regression to the health-check/rollback flow that already works).

## Out of scope

- The front-end spinner that never surfaces a 413/upload error to the user —
  real but separate defect, not touched by this spec.
- `deploy.sh` (the manual path) — already correct via `docker compose down`,
  left untouched to avoid an unrelated behaviour change to the manual script.
- Switching `nginx.conf` from a single-file bind mount to a directory mount —
  a valid alternative mitigation per `docker-vps-ops` skill, but changes the
  volumes section and is a separate, larger-blast-radius change than forcing a
  recreate; not pursued here.

## Files and signatures (draft)

- `.github/workflows/deploy-production.yml` — "Deploy the revision" step
  (around line 237, after `docker compose build ...`): add
  `docker compose up -d --force-recreate nginx` alongside the existing
  `docker compose up -d`. Same change in "Roll back to the previous revision"
  (around line 341).

## Contract change

none.

## Risks and invariants

- Recreating `nginx` on every deploy drops in-flight connections to it for the
  few seconds a stateless reverse proxy takes to restart; acceptable, same as
  any other deploy-time restart already accepted for `app`.
- Must not change `app`'s recreate condition or the health-check/rollback
  sequencing that already passes.
- Must not affect `deploy.sh`, the shared VPS host's other containers
  (`news-nginx`, `sites-nginx`, `searx*`), or any other compose project.

## Verification plan

- AC1 → read the diff: the "Deploy the revision" step's remote script contains
  an explicit `docker compose up -d --force-recreate nginx` after the build.
- AC2 → same read for the "Roll back to the previous revision" step.
- AC3 → `npm run check:context` (workflow file is outside its scope, included
  only to confirm no unrelated repo state drifted) and a manual diff review
  confirming the `app` build/up sequence is untouched.
- A real end-to-end proof (next production deploy recreates `nginx` with a
  fresh `StartedAt` even when only `nginx.conf` changed) is deferred to the
  next authorized deploy, since running the deploy workflow itself requires
  separate owner authorization per `AGENTS.md` ("Git and production").

Standing checks: `npm run check:context`. No `src/`, `prisma/`, `scripts/` or
`tests/` paths are touched, so `typecheck`/`test:app`/`build` do not apply.

## Result and handoff

Pending owner approval; no code committed yet.
