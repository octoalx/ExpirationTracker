# Development workflow: spec first, owner approves, checks prove it

The single source of truth for how a task moves from a request to `main`. The
`AGENTS.md` contract states the invariants; this file states the loop.

The audit of 2026-10-23 (`docs/specs/2026-10-23-spec-driven-execution.md`) found
that plans were written *with* the code: 24 of 24 merged PRs had no review, the
median merge happened 3.3 minutes after the PR opened, and one working-tree sync
inlined an older tree and deleted a mobile screen for eight days. The loop below
exists to move the specification one phase earlier — before code — and to make
the approval gate machine-checkable.

## Where things live

| Artifact | Path | Written by |
| --- | --- | --- |
| Contract and invariants | `AGENTS.md` | owner and agents, in its own commit |
| This loop | `docs/engineering/workflow.md` | agent, in its own commit |
| Task specification | `docs/specs/YYYY-MM-DD-<slug>.md` | agent, then approved by the owner |
| Templates | `docs/specs/TEMPLATE--feature.md`, `TEMPLATE--defect.md` | agent |
| Architecture decisions | `docs/adr/NNNN-<slug>.md` | agent, one file per decision |
| Rollout and release records | `docs/plans/YYYY-MM-DD-<slug>.md` | agent |
| Current state | `memory-bank/activeContext.md` (≤150 lines) | agent |

## The loop

0. **Classify.** The owner describes the task in words. The agent labels it
   `defect`, `feature`, `contract` (API, schema, invariants) or `ops` (CI, CD,
   scripts, documentation). The label fixes which sections the spec needs and
   which checks apply. A task that changes API shape, the Prisma schema or an
   invariant is always `contract`, never `feature`.
1. **Spec.** The agent writes `docs/specs/YYYY-MM-DD-<slug>.md` from the matching
   template with `Status: DRAFT`. The first section is in Russian, for the owner:
   what changes for them and how they will see it. Everything else is in English.
   No branch, no code, no test edits yet.
2. **Approval.** The owner answers `APPROVED` in chat or sets the line himself.
   The agent then writes `Status: APPROVED` and `Owner approval: <who, date,
   where>`. A rejected spec is revised, not argued.
3. **Branch.** `local/<slug>` from a freshly fetched `origin/main`. Never from a
   stale local `main`: two red runs on `local/settings-team-tab` came from that
   exact mistake.
4. **Implementation.** Strictly along the spec's file list. A file that turns out
   to be needed but is not listed is a stop: update the spec list, then write an
   `out-of-spec: <path>, <reason>` line in the spec and repeat it in the PR body.
5. **Checks, in this order.** Nearest behavioural test → `npm run typecheck` →
   `npm run test:app` → `npm run check:context` and `npm run test:harness` →
   `npm run build` when bundling changed → a migration run on disposable SQLite
   when the schema changed → a real browser walk-through when a screen changed.
6. **Report.** One line per criterion: `ACn → PASS/FAIL/SKIP — <evidence>`. SKIP
   is never PASS. Failures and unverified behaviour are reported as they are.
7. **Pull request.** Body = spec path + the AC→checks table. One branch, one
   spec, one PR. The spec gate (`npm run check:spec`) runs in CI.
8. **Merge.** Only the owner merges, answering five questions in the PR.
9. **After merge.** Update `memory-bank/activeContext.md` within its line cap and
   archive the rest into the dated plan. Delete the branch. A release is a
   separate explicit authorization and is never part of the merge.

## What the gate checks

`npm run check:spec` (CI: the `spec gate` step in
`.github/workflows/engineering.yml`) fails a pull request when:

- the diff touches `src/`, `prisma/`, `scripts/`, `tests/`, `Dockerfile`,
  `docker-compose.yml`, `package.json` or `.github/workflows/`, and the PR body
  names no file under `docs/specs/`;
- the named spec does not exist, or its `Status` is not `APPROVED` (or
  `IMPLEMENTED`, for re-runs after merge), or `Owner approval` is empty;
- an acceptance criterion (`AC1`, `AC2`, …) has no counterpart in the spec's
  verification plan;
- a changed file under the gated paths is missing from the spec's file list and
  no `out-of-spec:` line names it.

Documentation-only diffs pass with a skip message. A PR body line
`No spec required: <reason>` is the deliberate escape hatch for chores —
dependency bumps, reverts, formatting sweeps carried out on their own. The claim
stays visible in the PR for the reviewer to reject.

Locally: `npm run check:spec` uses the current branch against `origin/main` and
reads the PR body from `PR_BODY` or `--body-file`. A pull request that predates
this gate can be checked with `--files <path>`.

## Commit hygiene

- One concern per commit. A feature, an LF or formatting sweep, a process
  document and `AGENTS.md` are four different commits in the same branch.
- Never a commit that replaces the working tree with another revision ("sync",
  "prod-aligned snapshot", "baseline"). Restore with `git revert` or
  `git cherry-pick` and name the revision in the message — `28719b8` is why.
- Behaviour and its test change together only when the spec has a `Contract
  change` section arguing why the old assertion was wrong. `c657690` rewrote a
  test to lock in a regression; the rule exists to make that visible.
- Stage explicit paths. Never `.env`, databases, backups or verification logs.
- Write the reason in the message: mechanism, affected invariant, checks with
  their counts. The history is the only place a future agent can learn why.

## Merge policy (owner)

Before merging, the owner answers in the PR:

1. Do the acceptance criteria match what I asked for?
2. Are there files outside the spec's list, and is each explained?
3. For a defect, is there evidence it failed before the fix?
4. Are the checks named with their results, and is any SKIP acceptable?
5. Is deployment claimed as done? (It must not be — release is a separate step.)

A "no" is a request for changes, not a reason to merge and fix later.

## Re-audit metrics (measure every two weeks)

- share of merged PRs with an `APPROVED` spec — target 100%;
- share of PRs above 400 changed lines — target ≤15%;
- files changed outside the spec — target 0;
- commits that sync or reformat the tree as their own purpose — target 0;
- incidents where a test was rewritten to match a defect — target 0;
- median merge latency — small fixes should stay fast; large PRs should slow down.
