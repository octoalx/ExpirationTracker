# ADR-0005: release is a manual, approved workflow run

Status: Accepted
Date: 2026-10-13
Applies to: `.github/workflows/deploy-production.yml`, `deploy.sh`, `nginx/`

## Context

Production is a single VPS running the app in Docker with a SQLite file. A deploy
restarts the container and touches the live database, so a merge must not be able
to reach production on its own.

## Decision

`.github/workflows/deploy-production.yml` runs only on `workflow_dispatch` and only
after the `production` environment approves it. It deploys a revision that is
already in `origin/main`, never a branch, and refuses a dirty host tree. Local
`deploy.sh` pulls `main` and stops containers; using it is an explicit owner
decision, not a routine step.

## Consequences

- Merge and release are separate decisions with separate evidence.
- Release preparation runs `npm run verify:release`, which fails closed for a
  missing application test or a revision not present in `origin/main`.
- A failed image build restores the previous revision automatically; the site keeps
  serving and data is untouched.

## Evidence

`.github/workflows/deploy-production.yml`, `docs/engineering/release.md`,
`scripts/verify.mjs`, `docs/plans/2026-10-13-cd-production.md`.
