# ADR-0006: cron and expiry boundaries stay in Europe/Minsk

Status: Accepted
Date: 2026-10-20
Applies to: `src/lib/server/jobs.ts`, expiry calculations in `src/lib/utils.ts`

## Context

Expiry urgency is the product: a row turns urgent when the remaining days cross a
threshold, and notifications are sent by a scheduled job. Mixing the server's UTC
clock with local product dates produces off-by-one-day warnings near midnight and
duplicate or missing notifications.

## Decision

Scheduled work uses `Europe/Minsk`. Expiry dates are date-only labels parsed
locally and compared against the start of the local day. `getExpiryStatus` takes an
optional reference date so tests can pin the clock.

## Consequences

- Do not change the timezone or the notification frequency silently; it is a
  product decision with an observable effect on customers.
- New scheduling or retry logic must survive repeated startup and repeated
  execution (idempotence by design, not by luck).
- Threshold boundaries are covered by tests: inclusive thresholds and the rollover
  at local midnight.

## Evidence

`AGENTS.md` invariants, `tests/inventory-thresholds.test.cjs`,
`tests/product-urgency-render.test.ts`.
