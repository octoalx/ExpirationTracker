# ADR-0004: tests stay offline from instrumentation

Status: Accepted
Date: 2026-10-13
Applies to: `tests/*`, `tests/helpers/*`, `src/instrumentation.ts`

## Context

Importing startup instrumentation in a test starts background jobs, schedules
notifications, prunes logs and creates backups against whatever database is
configured. A "unit" test could therefore send a real Telegram message.

## Decision

Tests use disposable storage and fake SMTP/Telegram transports. They never import
`src/instrumentation.ts` and never run live notification scripts. Application code
must stay importable without side effects; startup work lives behind
`src/lib/server/jobs.ts` and is disabled with `DISABLE_BACKGROUND_JOBS`.

## Consequences

- Suites run offline, in parallel, on a temporary SQLite file.
- A module that performs I/O at import time is a defect, not a convenience.
- CI provides a placeholder `DATABASE_URL` so `prisma generate` runs without
  opening a database.

## Evidence

`tests/helpers/disposable.ts`, `tests/harness.test.mjs`,
`.github/workflows/engineering.yml`.
