# <Defect title>

Status: DRAFT
Owner approval:
Type: defect
Branch: local/<slug>
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves. Until then no branch, no code. See `docs/engineering/workflow.md`.

## Что изменится для вас

Two or three plain sentences in Russian: what stops happening and how the owner
can see that it is fixed.

## Problem

The observed wrong behaviour, when it started, and the mechanism behind it — not
just the symptom. Name the commit or file that introduced it when the history
shows it (`git log -S`, `git blame`), because in this repository two regressions
arrived through working-tree syncs rather than through intended edits.

## RED evidence

The command, request or test that fails **before** the fix, with its actual
output pasted here:

```
$ npm run test:app --  # or the exact focused command
… failing assertion …
```

A defect without RED evidence is a hypothesis. If the behaviour cannot be
captured by a test, record the reproduced request and response instead and say
why a test is impractical.

## Acceptance criteria

- AC1 — the broken path now returns / renders / stores <observable result>
- AC2 — the previously passing behaviour is unchanged

## Out of scope

Neighbouring code that is tempting to clean up here. This repository's history
shows that "while I am here" edits are how mobile screens get deleted — list them
as out of scope explicitly.

## Files and signatures (draft)

- `src/lib/utils.ts` — `getExpiryStatus(date, urgent, warning, referenceDate?)`
- `tests/<suite>.test.cjs` — new assertion for AC1

Paths in backticks; the spec gate compares them with the diff.

## Contract change

Write `none` unless the fix corrects a test that asserted the broken behaviour.
In that case: which test, what it wrongly locked in, and how the replaced
assertion follows from AC1. This is the one place where touching a test is
legitimate, and it must be argued, never silent.

## Risks and invariants

Only those that apply: department scope, data preservation, expiry boundaries,
notification duplication, timezone, UI on a phone at 360 px.

## Verification plan

- AC1 → `tests/<suite>.test.cjs` <test name>, red before, green after
- AC2 → the suite that covered this path before the fix, unchanged and green

Standing checks: `npm run typecheck`, `npm run test:app`,
`npm run check:context` + `npm run test:harness`, `npm run build` when bundling
changed, browser walk-through when the fix is visible on a screen.

## Result and handoff

Actual results, one line per criterion:

- AC1 → PASS — <evidence: command and count>
- AC2 → PASS — <evidence>

SKIP is never PASS. Finish with unresolved limitations and the next useful step.
