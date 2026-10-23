# Task title

Status: DRAFT
Evidence:

`Status:` is mandatory and must be one of `DRAFT` (written, not started),
`DONE`, `PARTIAL` (shipped with a named gap), `SUPERSEDED` (another commit, PR or
plan replaced it) or `ABANDONED` (never happened). Only the first and last need no
proof; `DONE`, `PARTIAL` and `SUPERSEDED` carry a non-empty `Evidence:` line naming
the commit, PR or plan that proves it. `scripts/check-plan-status.sh` enforces
this, so a plan can never again read like completed work because nobody updated it.

`ABANDONED` with `Evidence: none found in git log` is a valid, honest record — it
says the task was dropped, which is exactly the fact a later session needs.

## Goal and acceptance criteria

Describe observable behavior and what proves it works.

## Scope and approach

List affected components and the smallest coherent implementation.

## Risks and invariants

Consider identity/ownership, data preservation, date/time boundaries, notification
side effects, UI states and backward compatibility where applicable.

## Verification

List focused behavioral checks, static checks and any isolated runtime evidence.
Record actual PASS/FAIL/SKIP results after execution.

## Result and handoff

Describe completed work, unresolved limitations and the next useful step.
