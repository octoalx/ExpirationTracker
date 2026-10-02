# Reproducible local baseline

## Goal

Install and lock existing dependencies, generate Prisma client, run TypeScript and
production compilation, and make local startup portable and safe to inspect.

## Approach and acceptance criteria

- Preserve earlier uncommitted workflow changes.
- Verify installation against the existing package lock using Docker's legacy peer resolution.
- Remove the redundant POSIX cron-start command; instrumentation owns startup.
- Add an explicit opt-out for background jobs before importing job services.
- Test enabled/disabled startup behavior without live integrations.
- Repair concrete baseline compilation errors; do not change product features.
- Run compilation with synthetic configuration and disabled background jobs.

## Boundaries

No production data, migrations, deployment, notifications, commit or push.
Record actual verification results and unresolved baseline issues below.

## Results

- Dependency installation succeeded after one network reset. Initial inventory
  incorrectly excluded the tracked lock. Preserve it and verify with `npm ci`.
- `npm ci --ignore-scripts --no-audit --no-fund` against the original lock:
  exit 0 (779 packages). Regenerated Prisma client and reran verification: all PASS.
- Prisma 7.8 client generation and `npm run typecheck`: exit 0.
- Native better-sqlite3 in-memory SELECT probe: PASS.
- `npm run build` with synthetic auth settings and disabled jobs: exit 0.
- `npm run verify`: all checks PASS, including three startup isolation tests.
- Local production server start was rejected by tool policy; HTTP/UI inspection
  was not performed. No production or application data was initialized.
- Linux/Docker execution, lint and broader business-flow coverage remain open.
