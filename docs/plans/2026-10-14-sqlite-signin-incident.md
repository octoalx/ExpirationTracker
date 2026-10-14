# SQLite sign-in incident and the hardening that followed

Dated: 2026-10-14. Covers the production sign-in failure of 2026-10-13 and every
change made in response. Written after the fixes were verified on the live host.

## Symptom

After the first CD deploy (run `38454141635`) the administrator could not sign in.
The container reported `running healthy` and the site answered, but every login
request failed:

```
[ERROR] Login error
  email: 'admin@localhost',
  error: 'PrismaClientKnownRequestError: Operation has timed out'   (P1008 SocketTimeout)
```

The database file was **intact the whole time**: `integrity_check` ok, 438 products,
4 users, 12 applied migrations. Only the sign-in path was broken.

## Cause, as established by reproduction

The first explanation - "a corrupt rollback journal blocks all reads" - was
**disproved by testing it**. On the live host, with a zeroed `dev.db-journal`
planted, reads kept working: `integrity_check` ok, `SELECT count(*) FROM User` ok,
and the exact `findUnique` query the login performs returned the admin row.

The real cause is `journal_mode=delete`. In that mode a writer takes a lock on the
whole database and every reader blocks until it times out. Reproduced directly:

```
forced mode: delete
writer holds BEGIN EXCLUSIVE (delete mode)
reader FAILED after 5119 ms: SQLITE_BUSY database is locked
```

So the corrupt journal was a **symptom** of a transaction killed mid-flight, not the
cause. A deploy recreated the app container while the built-in backup job was running
(all four users have `backupEnabled=1`, `backupTime=03:00`), leaving the journal
behind - harmless on its own, fatal in `delete` mode under a concurrent writer.

## Fixes

| Change | Effect |
| --- | --- |
| WAL asserted on every startup (`docker-entrypoint.sh` before migrations, `src/instrumentation.ts`, and the Prisma client) | Readers never block the writer. WAL is a persistent file property, so it is re-asserted rather than assumed |
| Invalid journals quarantined at startup (`src/lib/server/sqlite-health.ts`) | A leftover journal moves to `backups/journal-quarantine/` (never deleted) and the app starts; a *valid* journal is left alone so SQLite can roll it back |
| Backup writes to a `.partial` file and renames on success (`src/lib/backupService.ts`) | An interrupted backup leaves no half-written snapshot |
| Health check queries the database (`scripts/release-healthcheck.sh`) | Asserts `integrity_check=ok`, at least one user, and **`journal_mode=wal`**. A container-level probe cannot see this failure; only a query can |
| `npm run build` added to CI | The build is what broke next, and type checking plus unit tests never exercise webpack's module resolution |

## Verification on the live host

The original failure was **replayed deliberately**: a 8720-byte zeroed
`dev.db-journal` was planted in `data/`, then the app was restarted.

```
[Startup] Quarantined invalid SQLite journal (8720 bytes) -> /app/backups/journal-quarantine/...
[Startup] SQLite journal_mode=wal
```

The app started clean, sign-in answered (`POST -> 401` in 0.77 s for a deliberately
wrong password, which proves the user lookup ran), 438 products and 4 users intact,
zero error lines. The test quarantine artifact was removed afterwards.

The health check was verified in both directions: it passes on the live database and
fails on an isolated copy forced to `delete` mode with
`CHECK WOULD FAIL: journal_mode=delete (expected wal)`.

## The deploy defects found on the way

Each was found by running the real workflow, not by reasoning about it.

1. **Helpers read from the host tree** (PR #12). The backup step called
   `scripts/release-backup.sh` on the host, which on a first deploy is an older
   revision without that script - and the checkout that brings it runs later. The
   helpers are now sent from the checkout being deployed. They are written to a file
   and run from there, never piped into `bash -s`: a stdin-fed script shares its
   stdin with its own commands, so `docker compose exec -T` consumed the rest of the
   script, which then exited 0 without printing `BACKUP_FILE`.
2. **The tree guard aborted on a clean tree** (PR #16). `grep -v` exits 1 when it
   matches nothing - exactly the clean case - and `set -e` killed the step. The guard
   failed only when there was nothing to guard against.
3. **A false rollback alarm** (PR #17). The rollback step was gated on `failure()`
   alone, so a preflight failure announced "Rollback failed; manual intervention
   required" for a deploy that had not started.
4. **The build broke on a native module** (PR #18). `instrumentation.ts` imports a
   module chain reaching `better-sqlite3`, and Next.js compiles instrumentation for
   every runtime including edge, where Node's `fs` does not exist. Server-only
   modules are now reached through a wrapper the bundler cannot trace statically.

## Deploy history

| Run | Result | What it exposed |
| --- | --- | --- |
| 38357335907 | fail | backup read its helper from the host tree |
| 38361289000 | success | dry run: connectivity and backup |
| 38454141635 | success | first real deploy; host tree synchronised with Git |
| 38466878102 | fail | `set -e` plus `grep` with no match; false rollback report |
| 38512003826 | fail | build: `Can't resolve 'fs'`; **rollback executed correctly** |
| 38513836556 | success | first successful deploy through CD |

## Still open

- `.release-version` is written before the image build, so the marker can claim a new
  revision while the container still serves the old one.
- A real rollback has been executed once (run `38512003826`) and behaved correctly;
  exercising it on a disposable host would still be worthwhile.
