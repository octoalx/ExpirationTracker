# Database robustness: WAL enforcement, journal quarantine, interruption-safe backups

## Goal and acceptance criteria

Make failed/half-finished backups and migrations unable to leave the SQLite
database in a state that breaks sign-in, and make WAL mode a guaranteed
property of a running instance.

Observable acceptance criteria:

1. WAL is set on the database file before any migration or cron job runs, both
   in the container entrypoint (`docker-entrypoint.sh`) and in the Node
   instrumentation hook (`src/instrumentation.ts`).
2. `createBackup()` uses the SQLite online backup API (`copySqliteSnapshot`) and
   never leaves a partial file: a failed or interrupted backup leaves no
   `expitrack-backup-*` fragment and no leftover snapshot in `data/`.
3. At startup, a `dev.db-journal` whose header cannot be a real journal is moved
   (not deleted) into `backups/journal-quarantine/` and the action is recorded in
   `SystemLog`; the application does not crash. A valid journal is never touched.
4. `npm run test:app` covers: invalid-journal detection, valid-journal
   preservation, WAL enforcement, and interruption-safe backup cleanup.

## Scope and approach

Affected components:

- `src/lib/server/sqlite-health.ts` (new) — journal inspection/quarantine plus
  WAL enforcement, consolidated into one startup health module.
- `src/instrumentation.ts` — run the health check before importing/starting
  background jobs.
- `docker-entrypoint.sh` — enforce WAL and quarantine before `prisma migrate
  deploy` (the earliest point in the container lifecycle).
- `src/lib/backupService.ts` — write the snapshot to a temp path and rename
  atomically; remove the temp file if the snapshot fails.
- `tests/db-robustness.test.ts` (new) — behavioral tests.
- `package.json` — register the new test file in `test:app`.

Smallest coherent change: one new module, wired into the two startup paths,
plus hardening of the existing backup write.

## Risks and invariants

- Never delete database data. A valid journal must be left for SQLite to roll
  back itself; only a header that cannot be a journal is quarantined.
- Never touch files other than `<dbPath>-journal`.
- `SystemLog` writes must never block startup: a failure to log is swallowed
  after the quarantine has already succeeded.
- WAL switch must be idempotent and safe to run on an already-WAL database.
- No schema change, so no migration is required.

## Verification

- `npm run test:app` (includes the new file) — behavioral PASS/FAIL.
- `npm run typecheck` — PASS/FAIL.
- `npm run check:context`, `npm run test:harness`.
- `bash .verification/run-verify-release.sh` if a release-level gate is wanted.

## Result and handoff

Implemented and verified locally (branch `local/db-robustness`, Node 22).

- `src/lib/server/sqlite-health.ts` — journal inspection, quarantine (move, not
  delete; falls back to a directory beside the database when `backups/` is not
  writable), `ensureWalMode`, and `prepareDatabaseForStartup`.
- `src/instrumentation.ts` — runs the guard before importing/starting jobs and
  records a quarantine in `SystemLog`.
- `src/lib/prisma.ts` — re-asserts WAL when the client is created.
- `docker-entrypoint.sh` — forces WAL and quarantines an unusable journal before
  `prisma migrate deploy` (self-contained copy, justified in a comment).
- `src/lib/backupService.ts` — writes the snapshot to `*.partial` and renames on
  success; removes the partial file on failure.
- `tests/db-robustness.test.ts` (+ `tests/instrumentation.test.cjs` update) —
  registered in `scripts.test:app`.

Verification: `npm run test:app` 90/90 PASS; `npm run typecheck` PASS;
`run-verify-release.sh` context/harness/typecheck/application tests PASS,
`published source` FAIL (branch not merged, expected). Entrypoint inline logic
exercised manually against a disposable database: corrupt journal quarantined
(8720 bytes preserved), `journal_mode=wal`, data readable.

Limitations: the Docker runtime path (alpine `nextjs` user, `/app/backups`
mount permissions) is not exercised locally; WAL persistence across a real
container recreation is untested here. The backup path was not run end to end
inside a container.

