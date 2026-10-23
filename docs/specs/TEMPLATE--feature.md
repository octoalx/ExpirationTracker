# <Task title>

Status: DRAFT
Owner approval:
Type: feature
Branch: local/<slug>
Spec gate: `npm run check:spec`

Replace `DRAFT` with `APPROVED` and fill `Owner approval` only after the owner
approves this file. Until then no branch, no code — the spec is the only file
that may change. See `docs/engineering/workflow.md`.

## Что изменится для вас

Two or three plain sentences in Russian: the visible effect and how the owner
will recognise it. No file names, no jargon.

## Problem

What is missing today and the evidence that establishes it (an observed screen,
a recorded request, a log line). If the change is not fixing a broken behaviour,
say what the owner cannot do now.

## Acceptance criteria

- AC1 — observable behaviour 1
- AC2 — observable behaviour 2

Every AC must be checkable by a command, a named test, a rendered screen or a
recorded response. "Works correctly" is not an AC. Keep the ids stable: they are
quoted in the PR, in the verification report and in the commit message.

## Out of scope

What this change deliberately does not touch. This is what lets a reviewer spot
scope drift instead of guessing.

## Files and signatures (draft)

- `src/pages/api/example.ts` — handler `POST`, new body field `urgentThreshold: number`
- `src/lib/server/example.ts` — `saveExample(input): Promise<Example>`
- `tests/example.test.cjs` — new suite

Write the paths in backticks: the spec gate compares them with the actual diff.
A file added during implementation needs a line here plus an `out-of-spec:` note
in this file and in the PR.

## Contract change

Only when the visible behaviour and an existing test change together: what
contract changes, why the old assertion was wrong, what replaces it. Otherwise
write `none`. Changing a test without this section fails review under the
test-as-spec rule.

## Risks and invariants

Cover only those that apply: identity and department scope, data preservation,
migration order, expiry date boundaries and timezone (Europe/Minsk for cron),
notification side effects, Telegram account linking, UI states on a phone.

## Verification plan

- AC1 → `tests/<suite>.test.cjs`, asserts <what>
- AC2 → manual: <screen> as MANAGER shows <result>

Standing checks: `npm run typecheck`, `npm run test:app`,
`npm run check:context` + `npm run test:harness`, `npm run build` when bundling
changed, a migration run on disposable SQLite when the schema changed, and a real
browser walk-through when UI changed.

## Result and handoff

After implementation, replace this section body with actual results, one line per
criterion:

- AC1 → PASS — `tests/<suite>.test.cjs`, 4/4
- AC2 → SKIP — no browser walk-through was run

SKIP is never PASS. Finish with unresolved limitations and the next useful step.
