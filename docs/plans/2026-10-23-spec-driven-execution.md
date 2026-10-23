# Rollout record: spec-driven execution with a HITL gate

Branch: `local/spec-driven-execution`. Date: 2026-10-23.
Specification and accepted decisions: `docs/specs/2026-10-23-spec-driven-execution.md`.

## What changed

Applies the action plan of the 2026-10-23 development-process audit.

- `docs/specs/` now holds two templates (`TEMPLATE--feature.md`,
  `TEMPLATE--defect.md`) and the specification of this change. Every spec carries
  `Status`, `Owner approval`, `Type`, `Branch`, acceptance criteria and a draft
  file list.
- `docs/engineering/workflow.md` states the loop: classify → spec → owner
  approval → branch from fresh `origin/main` → implement along the spec's files →
  checks in order → AC-mapped report → PR → owner merge → context update.
- `scripts/check-spec.mjs` implements the deterministic gate and
  `npm run check:spec` exposes it. It fails a pull request when a gated path
  changes without a spec, when the spec is not `APPROVED`, when an acceptance
  criterion has no verification entry, or when a changed file is missing from the
  spec's list and no `out-of-spec:` line explains it. Documentation-only diffs
  pass, and a `No spec required: <reason>` line is the explicit chore override.
- `.github/workflows/engineering.yml` runs the gate on every pull request
  (`fetch-depth: 0`, base `origin/<base_ref>`); push events skip it.
- `docs/adr/0001..0007` backfill six decisions that lived only inside dated plans
  and record this process decision.
- `docs/engineering/README.md` routes to the workflow, the spec templates and the
  decision records.

No application code, schema, migration, notification or UI behaviour changed.

## Verification (actual results)

- `npm run check:context` → PASS (contract budget, documentation links).
- `npm run test:harness` → 12/12 PASS, including six new cases for the gate:
  documentation-only skip, missing spec reference, unapproved spec, empty
  approval line, unmapped acceptance criterion, unlisted file with and without an
  `out-of-spec:` line, chore override and a missing spec file.
- `npm run typecheck` → PASS.
- `node scripts/check-spec.mjs --base origin/main --body-file <pr body>` → PASS
  "spec gate satisfied for 4 changed file(s)"; the same command without a body →
  FAIL "PR body names no spec", exit 1. The gate is therefore exercised in both
  directions on this very change.
- `npm run test:app` → 102/102 PASS (unchanged by this work, run for the record).

## Unresolved and next step

- `AGENTS.md` is deliberately untouched: the contract amendments (one task = one
  spec, no mixed commits, no working-tree sync commits, test-as-spec rule,
  `activeContext.md` line cap) are a separate commit awaiting owner approval. Until
  it lands, the gate is enforced by CI while the contract does not yet state the
  rule in prose.
- Branch protection and required-review settings are unchanged; the merge policy
  is documented, applying it remains a human action.
- The 24 pull requests merged before this date predate the gate and are not
  retro-fitted.
- Next: amend `AGENTS.md`, then re-audit in two weeks against the metrics in
  `docs/engineering/workflow.md` (approved-spec share, PR size, out-of-spec files,
  sync/format commits, test rewrites, merge latency).
