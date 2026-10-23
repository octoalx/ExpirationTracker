# Spec-driven execution with a human approval gate

Status: APPROVED
Owner approval: Alex (owner), 2026-10-23, in chat ("Ок" on the audit report and action plan)
Type: ops
Branch: local/spec-driven-execution
Spec gate: `npm run check:spec`

## Что изменится для вас

Работа над приложением пойдёт по одному правилу: сначала я пишу короткую
спецификацию задачи — что именно изменится, как вы это увидите и какие файлы
будут затронуты, — и только после вашего «APPROVED» появляется код. Раньше такого
шага не было: план писался уже вместе с кодом. Проверка автоматическая: если в PR
нет утверждённой спецификации, CI не даст его смержить.

## Problem

The audit of 2026-10-23 (118 commits, 24 merged PRs) established:

- 24 of 24 merged PRs carry zero reviews; median merge latency is 3.3 minutes and
  18 of 24 were merged within 15 minutes, including a 45-file, 1982-line diff
  merged in 3 minutes (PR #22). The merge click is the only human step and it is
  made after the code exists.
- Plan files exist for 21 of 42 non-merge commits but are committed **together
  with** the code they describe, so they document decisions rather than gate
  them. The single genuine spec-first cycle was the handoff brief for the
  department access model.
- `28719b8` ("Sync production working tree with origin/main") replaced a newer
  mobile lineage with an older tree; the mobile inventory screen disappeared for
  eight days and `c657690` rewrote its test to assert the broken contract.
- Commit `e386d4e` mixes a UI change, an LF sweep and process rules; `75ec4e5`
  changes `AGENTS.md` inside a feature commit.

Nothing in the tooling prevents these patterns: `src/` can be changed with no
agreed specification, tests can be rewritten to match a defect, and architecture
decisions live only inside dated plans.

## Acceptance criteria

- AC1 — `docs/specs/` exists with a feature template and a defect template, each
  carrying `Status`, `Owner approval`, `Type`, `Branch` and `AC` ids.
- AC2 — `docs/engineering/workflow.md` states the loop, the gate rules, commit
  hygiene and the merge policy, and is linked from the engineering routing doc.
- AC3 — `npm run check:spec` fails when a source diff has no spec, when the spec
  is not `APPROVED`, when an AC has no verification entry, or when a changed file
  is missing from the spec's file list without an `out-of-spec:` line.
- AC4 — the same gate runs in CI on every pull request and skips documentation-only
  changes without failing them.
- AC5 — `docs/adr/0001..0007` record the six decisions that currently live only
  inside dated plans, plus this process decision, each with status and consequences.
- AC6 — `npm run test:harness` covers the gate's pass and fail paths, including
  the `No spec required:` override and an unapproved spec.

## Out of scope

- No change to application code, Prisma schema, migrations, notifications or UI.
- No change to `AGENTS.md` in this commit: the contract amendments (one task =
  one spec, no mixed commits, no working-tree sync commits, test-as-spec rule,
  active-context line cap) are a separate commit awaiting its own approval.
- No branch protection or repository setting change; the merge policy is written
  down here, applying it stays a human action.
- No reorganisation of the existing 46 files in `docs/plans/`.

## Files and signatures (draft)

- `docs/specs/TEMPLATE--feature.md` — new template
- `docs/specs/TEMPLATE--defect.md` — new template
- `docs/specs/2026-10-23-spec-driven-execution.md` — this spec
- `docs/engineering/workflow.md` — new regulation, single source of truth
- `docs/engineering/README.md` — routing table gains the workflow and ADR rows
- `docs/adr/README.md` — ADR index and conventions
- `docs/adr/0001-department-is-the-only-product-scope.md`
- `docs/adr/0002-administrator-has-no-product-rows.md`
- `docs/adr/0003-sqlite-in-wal-with-journal-quarantine.md`
- `docs/adr/0004-tests-stay-offline-from-instrumentation.md`
- `docs/adr/0005-release-is-manual.md`
- `docs/adr/0006-cron-stays-in-europe-minsk.md`
- `docs/adr/0007-spec-first-with-an-approved-spec-gate.md`
- `scripts/check-spec.mjs` — `checkSpec({ root, files, prBody })` returning failures, plus CLI
- `tests/harness.test.mjs` — cases for the gate
- `package.json` — `check:spec` script
- `.github/workflows/engineering.yml` — spec gate job step on `pull_request`
- `docs/plans/2026-10-23-spec-driven-execution.md` — rollout record and verification

## Contract change

`none` — no application behaviour and no existing test changes. `tests/harness.test.mjs`
gains new cases; no existing assertion is edited.

## Risks and invariants

- The gate must not be able to pass silently: a spec with `Status: DRAFT`, an empty
  `Owner approval`, or an AC missing from the verification plan is a failure, and a
  gate that cannot read the PR body must fail open only for documentation-only
  diffs, never for source diffs.
- The gate runs offline: no network, no dependencies beyond Node's standard library,
  and it must not touch the database or the application bundle.
- `check:context` keeps enforcing the `AGENTS.md` token budget and documentation
  links; the new templates and ADRs are covered by its link walk.
- Escape hatch by design: a PR body line `No spec required: <reason>` skips the
  gate for chores (dependency bumps, reverts). It is explicit in the PR, so a
  reviewer can see the claim.
- Documentation growth is the risk this change also fights: the workflow doc stays
  under one page of rules, ADRs stay short, and the re-audit metrics bound drift.

## Verification plan

- AC1 → `npm run check:context` (links resolve) and a read of both templates
- AC2 → `npm run check:context` link walk from `docs/engineering/README.md`
- AC3 → `npm run test:harness`, cases "spec gate fails without a spec reference",
  "… without approval", "… with an unlisted file", "… with an unmapped AC"
- AC4 → `node scripts/check-spec.mjs --files docs/engineering/workflow.md` returns
  PASS (documentation-only skip); the workflow file contains the gate step
- AC5 → `npm run check:context` link walk over `docs/adr/`
- AC6 → `npm run test:harness` full run

Standing checks: `npm run check:context`, `npm run test:harness`, `npm run typecheck`.
`npm run test:app` is not affected (no application code changed) but is run once for
the record.

## Result and handoff

- AC1 → PASS — `docs/specs/TEMPLATE--feature.md` and `TEMPLATE--defect.md` exist,
  both carry Status/Owner approval/Type/Branch and AC ids; `check:context` link
  walk clean.
- AC2 → PASS — `docs/engineering/workflow.md` exists and is linked from
  `docs/engineering/README.md`; `check:context` PASS.
- AC3 → PASS — `npm run test:harness` 12/12, six gate cases including the missing
  spec, unapproved status, empty approval, unmapped AC and unlisted file.
- AC4 → PASS — `check-spec` skip path returns "no gated files changed"
  (`--files docs/engineering/workflow.md`), and `.github/workflows/engineering.yml`
  gained the `spec` job conditional on `pull_request`.
- AC5 → PASS — `docs/adr/0001..0007` plus index; `check:context` walk clean.
- AC6 → PASS — `npm run test:harness` 12/12 (6 pre-existing, 6 new), 0 fail.

End-to-end evidence for the gate on this change: with the PR body naming this spec
`node scripts/check-spec.mjs --base origin/main` reports "spec gate satisfied for 4
changed file(s)"; without the body it reports "PR body names no spec …" and exits 1.

Unresolved: `AGENTS.md` amendments await their own approval, so the prose contract
does not yet state the rule the CI enforces; branch protection is unchanged; the 24
pre-existing pull requests are not retro-fitted. Next useful step: the `AGENTS.md`
amendment commit, then the two-week re-audit.
