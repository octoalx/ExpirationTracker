# ExpirationTracker engineering contract

## Ownership and communication

Act as the engineer responsible for investigating, implementing, verifying and
reporting the requested outcome. Communicate with the owner in Russian. Write
new code, tests, technical documentation and comments in English. Preserve the
existing product language. Resolve routine reversible engineering choices
autonomously; ask only for missing material product decisions or authorization.

## Context and workflow

- Inspect `git status --short` and preserve unrelated changes before editing.
- Translate the request into a goal and observable acceptance criteria.
- Read only relevant files. Start with this contract; use
  `docs/engineering/README.md` for routing, not as mandatory background reading.
- Small fixes need a short plan in chat. Multi-component features, API changes,
  migrations and scheduling changes need a dated plan in `docs/plans/` with
  acceptance criteria, risks and verification before implementation.
- Implement the smallest coherent change. Confirm suspected causes against code.
- Work directly for routine tasks. Delegate only when explicitly requested by
  the owner; keep delegated tasks bounded and avoid overlapping edits.
- Review the diff and run fresh checks before reporting completion. Report
  failures, skips and unverified behavior accurately; never equate SKIP with PASS.
- Update `memory-bank/activeContext.md` at meaningful milestones, keeping it
  concise. Load it only when resuming work. Archive detailed history in plans.

## Project map

- `src/pages/` — Next.js 14 Pages Router screens and API routes.
- `src/components/` — React UI; `src/components/ui/` — shared primitives.
- `src/lib/` — auth, Prisma, cron, backup, Excel and shared utilities.
- `src/services/` — email and notification delivery.
- `prisma/schema.prisma`, `prisma/migrations/` — SQLite schema and migrations.
- `src/instrumentation.ts`, `src/lib/server/jobs.ts` — background job startup.
- `scripts/` — operator tools and development verification.
- `Dockerfile`, `docker-compose.yml`, `nginx/` — deployment configuration.

## Required invariants

- Private APIs derive identity from the verified NextAuth session. Scope product
  reads and mutations by that user's current store membership, or personal ownership
  outside a store. Telegram actions use a confirmed unique account link and recheck
  membership. Store management requires MANAGER; admin operations require ADMIN.
- Keep Prisma, credentials and server services out of browser bundles.
- Never hardcode or log secrets, SMTP passwords, Telegram tokens or session data.
  Environment settings belong in `.env.example`; per-user integrations live in Settings.
- Preserve optional expiry dates, quantities and ACTIVE/ARCHIVED/DEFECT semantics.
  Cover date boundaries and timezone behavior when modifying expiry calculations.
- Cron currently uses Europe/Minsk. Do not silently change timezone or notification
  frequency. New scheduling/retry logic must handle repeated startup and execution.
- Schema changes require incremental Prisma migrations and a data-preservation
  check on disposable SQLite storage. Never reset, force-push schemas, restore over
  real data or delete database files as a routine repair.
- Tests use disposable storage and fake SMTP/Telegram transports. Do not import
  startup instrumentation or run live notification scripts during offline tests.
- App startup can schedule notifications, prune logs and create backups. Use only
  isolated development settings and fake integrations for runtime verification.

## Proportional verification

- Dev loop: run the nearest behavioral test for changed logic.
- Task completion: touched tests, relevant static checks and diff review. For
  contract/tooling changes run `npm run check:context` and `npm run test:harness`.
  For TypeScript changes run `npm run typecheck` after dependencies are installed.
- Release preparation: `npm run verify:release` plus the checks and manual
  evidence in `docs/engineering/release.md`. The gate currently fails closed for
  missing application tests or dependencies. A local report is not release approval.
- Do not run an interactive `next lint` setup as verification. The current lint
  command has no committed ESLint configuration; establish it in a separate task.

## Git and production

Stage explicit files only. On an explicit commit request, make an ordinary commit;
no candidate manifests or repeated confirmation rituals. Push only when requested.
Never discard owner changes, rewrite history or force-push without authorization.
Never commit `.env`, databases, backups, credentials or verification logs.

A local change does not authorize deployment. Run `deploy.sh`, production
migrations, remote commands, backup restoration or real email/Telegram sends only
within an explicitly authorized task. `deploy.sh` pulls main and stops containers;
review the exact revision and backup/recovery plan before using it.

## Completion

Report the outcome, significant files, executed checks with results, and remaining
limitations in concise Russian. Describe practical effects rather than tool history.
