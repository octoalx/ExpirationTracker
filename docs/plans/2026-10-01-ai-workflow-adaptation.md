# Adapt the lean AI engineering workflow

## Goal and acceptance criteria

Adapt PureRecipe's engineering approach to ExpirationTracker without changing
application behavior. Provide a concise agent contract, task-specific documentation,
durable handoff, runnable verification and honest release readiness reporting.

Source: `octoalx/purerecipe` at
`04accc4dea91784a541dbbcdae95d3bd48ef8aa6` (inspected 2026-10-01).
Relevant sources: `AGENTS.md`, `docs/AUTONOMY.md`,
`docs/agentic/task-runbook.md`, `scripts/verify.py`, the CI workflow and
`docs/plans/2026-09-29-lean-agentic-workflow.md`.

## Scope and approach

- Adapt the compact contract to Pages Router, NextAuth, Prisma/SQLite and cron.
- Keep routine decisions autonomous, context selective and verification proportional.
- Add versioned documentation and a small active-context handoff.
- Add dependency-free Node tooling checks and a status-only local report.
- Add Windows/Linux CI for tooling only; do not advertise application coverage.
- Keep model/provider preferences and PureRecipe deployment configuration out.

## Risks and invariants

Preserve app behavior, existing deployment configuration and data. Do not start
instrumentation/cron, install dependencies, read runtime secrets, send notifications,
commit or deploy as part of this task. `docs/` was ignored and is now versioned.
App tests and lint config were baseline gaps. Correction on the next task: a
tracked package lock existed; the initial inventory had excluded it by mistake.

## Verification and result

`npm run verify`: PASS for documentation/context and three harness tests; SKIP for
TypeScript and application tests because local prerequisites are absent.
`git diff --check`: exit 0.
`npm run verify:release`: exit 1 as expected; missing TypeScript dependencies and
application tests are FAIL rather than SKIP. No release readiness is claimed.

Harness tests exercise broken links, instruction growth, missing prerequisites,
release failure, subprocess failures and timeouts. These are tooling checks;
application behavior, Linux execution and remote CI execution remain unverified.

## Handoff

The workflow is implemented locally. Next establish reproducible dependencies,
noninteractive linting, safe local startup and offline application regression tests.
