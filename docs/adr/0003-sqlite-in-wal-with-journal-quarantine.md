# ADR-0003: SQLite runs in WAL, corrupt journals are quarantined

Status: Accepted
Date: 2026-10-14
Applies to: `src/instrumentation.ts`, `src/lib/*`, backup and restore paths

## Context

On 2026-10-13 sign-in failed in production. The database was in rollback-journal
mode, one writer blocked every reader, and a corrupt `dev.db-journal` left the app
unable to open the file at all. A failed backup must never be able to do that.

## Decision

The app asserts `journal_mode = WAL` on every startup and quarantines a corrupt
journal instead of refusing to start. Releases take a verified snapshot first and
refuse to continue without one; the health check asserts WAL and a readable
database.

## Consequences

- Production database is a single file of roughly 98 MB; the WAL files travel with
  every backup and snapshot.
- A deploy takes 8–25 minutes on this VPS (2 cores, 1.9 GB). A long build is
  normal, not a failure.
- Local Node matters: Node 22 breaks `better-sqlite3` builds compiled for another
  ABI — the full suite runs under the Node that built `node_modules`.

## Evidence

`docs/plans/2026-10-14-sqlite-signin-incident.md`,
`docs/plans/2026-10-13-db-robustness.md`, `tests/db-robustness.test.ts`,
`.github/workflows/deploy-production.yml`.
