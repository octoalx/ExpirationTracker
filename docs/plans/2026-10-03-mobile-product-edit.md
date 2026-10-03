# Mobile product editing — 2026-10-03

## Goal and acceptance criteria
- Opening edit does not focus an input or overflow horizontally on phones.
- Manufacture-based products retain their source date, duration and unit; editing
  recalculates expiry with the existing calendar arithmetic.
- Expiry-only products keep optional expiry dates; legacy records remain intact.
- Mobile expiry markers stay adjacent to their labels, including wrapped labels.

## Implementation and risks
Add nullable manufacture metadata through an incremental SQLite migration, share
API validation/calculation, and update add/edit forms. Legacy manufacture dates
cannot be recovered from expiry alone. Deploying requires applying the migration;
production deployment is outside this task.

## Verification
Run disposable SQLite migration/API regression tests, calendar boundary tests,
application tests, TypeScript checks and diff review. No startup or live transports.

## Results
- Application suite: 26 passed, zero skipped; harness: 3 passed, zero skipped.
- Typecheck, context check and diff whitespace check passed.
- Disposable SQLite confirms legacy row preservation, manufacture recalculation,
  invalid-date rejection, optional expiry clearing and session owner isolation.
- Backup restore regression covers metadata preservation.
- No real-device/browser visual verification or production migration performed.
