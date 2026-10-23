# ADR-0007: spec first, owner approves, a gate enforces it

Status: Accepted
Date: 2026-10-23
Applies to: `docs/specs/`, `docs/engineering/workflow.md`, `scripts/check-spec.mjs`,
`.github/workflows/engineering.yml`

## Context

An audit of 118 commits and 24 merged pull requests (2026-10-23) found the loop had
no human gate in practice: zero reviews, median merge latency 3.3 minutes, plans
committed together with the code they describe, a 45-file diff merged in three
minutes, and one working-tree sync (`28719b8`) that deleted a mobile screen for
eight days while a test was rewritten to assert the broken contract (`c657690`).
Discipline existed; enforcement did not.

## Decision

Every task that touches source, schema, scripts, tests or workflows starts with a
specification in `docs/specs/` carrying `Status`, `Owner approval`, acceptance
criteria and a draft file list. Code exists only after the owner approves. A
deterministic gate (`npm run check:spec`, wired into CI) fails a pull request
without an approved spec, without a verification entry per criterion, or with a
changed file the spec does not list and no `out-of-spec:` line explains. The loop is
documented once in `docs/engineering/workflow.md`.

## Consequences

- The owner's approval becomes a file, not a memory; the agent cannot start coding
  before it exists.
- Small fixes stay fast: the spec for a one-file defect is a dozen lines.
- The gate proves that an approval happened, not that it was informed. The owner's
  five merge questions remain the human step; the gate only bounds the damage.
- Escape hatch: a PR body line `No spec required: <reason>` for chores, visible to
  the reviewer and rejectable.
- Re-audit every two weeks against the metrics listed in the workflow document.

## Evidence

`docs/specs/2026-10-23-spec-driven-execution.md`,
`docs/engineering/workflow.md`, `scripts/check-spec.mjs`.
