# Active context

2026-10-06: Account settings now validate name/email and allow password changes
with current-password confirmation and new-password repetition. Email conflicts
roll back profile/settings; session updates reload trusted database profile fields.
7 focused tests and typecheck passed. Full app suite: 61 passed, 1 failed because
catalog-api's mock lacks inventory-import from existing Excel work. Browser UI
and deployment were not exercised. Details: `docs/plans/2026-10-06-account-settings.md`.

2026-10-06: Added simple Excel import alongside inventory/catalog formats.
First row is headers; fixed columns are barcode, name, date, optional months.
Blank months mean final expiry. Shared parser drives preview; API validates all
rows before transactional owner-scoped creation and preserves unknown expiry.
Focused tests (15) and TypeScript passed. No deployment or live integrations.
Details: `docs/plans/2026-10-06-simple-excel-import.md`.

## Catalog upload UI — 2026-10-06
- Simplified admin catalog copy and replaced native DBF pickers with accessible Russian file-selection controls, selected filenames/sizes and pair count. Limits and parsing statistics remain expandable; import behavior is preserved.
- Verification: typecheck and 8 catalog DBF/import tests passed; Browser screenshots verified at 390x844 and 1440x1000 with a fake admin session and background jobs disabled. File selection states passed without horizontal overflow or JS errors. Compact spacing keeps the check action above mobile navigation at 390x844. Screenshots: .verification/catalog-ui/. Native iOS Safari and real DBF import were not exercised.
