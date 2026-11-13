# Task continuity: a new task starts as a new session

Status: APPROVED
Owner approval: Alex, 2026-10-23, Telegram — authorised the whole scope ("всё сразу": the AGENTS.md rule, the plan statuses, the Hermes behaviour) before this spec file existed; the spec was written alongside the work and is retroactive, see "Problem".
Type: ops
Branch: local/task-continuity
Spec gate: `npm run check:spec`

## Что изменится для вас

Каждая новая задача будет начинаться с чистого разговора и чтения
`memory-bank/activeContext.md`, а не с длинной истории прошлого чата. Один разговор —
одна задача; начинается следующая — начинается и новый разговор. Кроме того, у каждого
артефакта в `docs/plans/` появится строка статуса, чтобы нельзя было принять прочитанный
план за выполненную работу. Вы увидите это как: агент в начале задачи говорит, где
сейчас стоит проект, ссылаясь на `activeContext.md`, а не пересказывает вчерашний чат.

## Problem

Two separate mechanisms produced the observed drift, and both are structural:

1. **Continuity was carried by the conversation, not by project state.** Work on
   `ExpirationTracker` ran for 1277 messages in one Telegram session
   (`20261023_131007_f759dc4c`, 8 user messages, 637 tool calls). When the owner
   opened a new chat (`22846`) to ask what happened, that session had no project
   state: one user message, no `activeContext.md` read, and the answer was
   "запрос непонятен". The prior session ended by handing off a standalone
   `ExpirationTracker-continuation.md` file rather than pointing at the in-repo
   state that already existed (`memory-bank/activeContext.md`, git history, PRs).
   So the state of the work lived in a chat transcript that no later session reads.
2. **Plans read like completed work.** 25 of 44 files in `docs/plans/` carry no
   status marker at all. A plan describes intended work in the imperative, so a
   later session (or the owner) reading `docs/plans/2026-10-02-mobile-ux-redesign.md`
   cannot tell "done in `dc07476`" from "abandoned". The same ambiguity is what
   makes "сделал / не сделал / сделал в другом чате" unanswerable.

The contract already says `memory-bank/activeContext.md` is loaded "only when
resuming work" and that plans are the archive — but nothing tells an agent that
starting a new task means starting a new session, and nothing marks a plan as
closed. That is the gap this spec closes.

## RED evidence

Not a behaviour test: this repository has no test harness for documentation
state. The evidence is a census, reproducible with:

```
$ ls docs/plans/*.md | wc -l
44
$ for f in docs/plans/*.md; do grep -qiE "^Status:|DONE|IMPLEMENTED|Merged" "$f" || echo "$f"; done | wc -l
25
$ python -c "import sqlite3;c=sqlite3.connect(r'C:\Users\Alex\AppData\Local\hermes\state.db');print(c.execute(\"select count(*) from messages where session_id='20261023_131007_f759dc4c'\").fetchone())"
```

Before: 25 plan files with no status, and a fresh session with no path to project
state. After: every plan file carries `Status:` and
`docs/engineering/workflow.md` states the session boundary rule.

## Acceptance criteria

- AC1 — `AGENTS.md` states, in the contract's own list, that a new task starts a
  new session and that project state is read from `memory-bank/activeContext.md`,
  git history and open PRs rather than from a previous conversation.
- AC2 — `docs/engineering/workflow.md` states the same boundary at phase 0
  (classify) and names where the state is read from; it also states that a
  handoff file is not the mechanism and that nothing outside the repo is a
  source of truth.
- AC3 — every file under `docs/plans/` (except `TEMPLATE.md`) has an explicit
  `Status:` line with a value from `DONE`, `PARTIAL`, `ABANDONED`, `SUPERSEDED`;
  `TEMPLATE.md` states the field is mandatory and lists the allowed values.
- AC4 — every plan marked `DONE`, `PARTIAL`, `SUPERSEDED` names the commit, PR
  or plan that proves it; a plan that cannot be proved is marked `ABANDONED`
  with `Evidence: none found in git log`.
- AC5 — `memory-bank/activeContext.md` records this change in one line and stays
  within its 150-line cap (`npm run check:context` passes).

## Out of scope

- Changing how any agent runtime (Hermes, Codex, Claude Code) stores sessions.
  This spec changes what the repository asks for, not the tool.
- Rewriting the plan texts themselves beyond adding the status block.
- Deleting any plan file. Archiving is a separate decision for the owner.
- Touching `src/`, `prisma/`, `tests/` or workflows. This is a documentation-only
  change and the spec gate should skip it.

## Files and signatures (draft)

- `AGENTS.md` — one bullet under `## Context and workflow`
- `docs/engineering/workflow.md` — phase 0 text plus a new note on session boundaries
- `docs/plans/` — a `Status:` and `Evidence:` block under the title of each of the 43 plans;
  `docs/plans/TEMPLATE.md` gets the field definition
- `scripts/check-plan-status.sh` — new: the census that enforces the field (gated path, hence this spec)
- `memory-bank/activeContext.md` — one line under the current section

## Verification plan

- AC1 → `grep -n "new session" AGENTS.md` returns the bullet; read it back.
- AC2 → `grep -n "session" docs/engineering/workflow.md` in the phase 0 block; read it back.
- AC3 → `bash scripts/check-plan-status.sh` (new, see below) exits 0 and prints `OK — 43 plans`.
- AC4 → the same script fails a `DONE`/`PARTIAL`/`SUPERSEDED` plan whose evidence pointer is empty.
- AC5 → `npm run check:context` passes, `wc -l memory-bank/activeContext.md` ≤ 150.
- Gate → `npm run check:spec -- --files docs/specs/2026-10-23-task-continuity.md` reports
  `PASS: no gated files changed, no spec required`.

## Results (executed 2026-10-23, branch `local/task-continuity`)

- AC1 → PASS — `AGENTS.md`, bullet "One task = one session" under `## Context and workflow`.
  `npm run check:context`: `PASS: context budget and local documentation links`
  (`AGENTS.md` 1951 → 1970 estimated tokens, cap 2000).
- AC2 → PASS — `docs/engineering/workflow.md`: phase 0 "Classify, in a new session"
  plus the new `## Session boundary` section.
- AC3 → PASS — `bash scripts/check-plan-status.sh` → `check-plan-status: OK — 43 plans,
  all with a status.` (43 modified plans plus `TEMPLATE.md`'s field definition).
- AC4 → PASS — the script's empty-`Evidence:` branch was exercised before the plans
  were filled (43 `MISSING STATUS` lines, exit 1) and after (exit 0); `ABANDONED`
  plans carry `Evidence: none found in git log` by design.
- AC5 → PASS — `memory-bank/activeContext.md` is exactly 150 lines, `check:context` passes.
- Gate → PASS — `PASS: no gated files changed, no spec required`.

Census the statuses rest on: 43 plans, of which 32 `DONE`, 7 `PARTIAL`, 2 `SUPERSEDED`,
2 `ABANDONED`. `PARTIAL` is used where the only proof is the `cc76ef9` working-tree
snapshot of 2026-10-03, which by the contract's own rule ("never a commit that replaces
the working tree with another revision") is not a per-change proof. `ABANDONED` covers
`2026-10-02-final-ux-verification` and `2026-10-02-replace-from-new-csv`: no commit,
no merge, no mention in the history exists for either.

The census script is added in the same branch and listed here rather than hidden
in the PR body, because a status field nobody checks decays within a month:

- `scripts/check-plan-status.sh` — exits non-zero when a plan file under
  `docs/plans/` lacks `Status:` with an allowed value, or carries a proof-bearing
  status with an empty `Evidence:` line.

## Contract change

`none`. No test currently asserts on the plan files or on `AGENTS.md` text.
