# Simple Excel import keeps final expiry dates

Status: DONE
Evidence: commit `d050f04`, merged as PR #21 (`0de6a25`)

## Goal and acceptance criteria

A simple Excel table with the columns barcode, name, date and optional shelf
life in months imports the date the way the import dialog and
`docs/plans/2026-10-06-simple-excel-import.md` describe: an empty months cell
means the date is the final expiry date, a positive whole number of months
means the date is a manufacture date and the expiry is calculated from it.

Observable proof: a row `4600000000002 | Хлеб | 15.06.2025 | <empty>` is
stored with expiry `2025-06-15` instead of an unknown expiry, while a row
`4600000000001 | Молоко | 01.03.2025 | 6` keeps the calculated `2025-09-01`.
Impossible calendar dates without months stay rejected and name the Excel row.

## Scope and approach

The regression came from `28719b8` (production-aligned sync), which changed
`expiryFromManufacture` to return `null` for a missing shelf life and removed
the test that pinned the final-expiry behavior. That helper serves two callers
with different semantics: the legacy tab-separated inventory, where a missing
shelf life means an unknown expiry, and the simple Excel table, where it means
the date is already the final expiry.

The fix is deliberately local to the Excel table:

- `src/lib/inventory-import.ts` gains `finalExpiryDate(date)`, which parses and
  calendar-validates a `DD.MM.YYYY` date and returns it as an ISO date. Date
  parsing moves into a shared `parseCalendarDate` helper so the manufacture
  path and the final-expiry path validate identically.
- `src/lib/excel-parser.ts` uses `finalExpiryDate` when the months cell is
  empty and keeps `expiryFromManufacture` when it is not.
- `expiryFromManufacture` keeps returning `null` for a missing shelf life, so
  the legacy tab-separated format and its unknown-expiry semantics are
  unchanged.

No schema change, no migration, no API change, no notification or scheduling
change. The import API already accepts a non-null `expiryDate` and writes it
as the product expiry.

## Risks and invariants

- Legacy tab-separated import is unaffected: `parseLegacyInventory` still maps
  a missing shelf life to a `null` expiry, and its existing test still passes.
- Calendar validation is not weakened. `31.02.2025` and `29.02.2025` without
  months are rejected with the Excel row number, as before.
- Date arithmetic stays in UTC, so host timezone and DST cannot shift a date.
- Month-end clamping for the manufacture path is untouched.
- The error message for an invalid date changed from "Некорректная дата
  производства" to "Некорректная дата" for the simple table, because that
  table may carry either a manufacture or a final expiry date. The legacy
  parser keeps its original message.
- Import remains create-only. Re-importing the same file still creates
  duplicates, because product barcodes are not unique. This is unchanged and
  remains a separate concern from this fix.

## Verification

- `npm run test:app`: PASS, 95 tests, no skips. Includes two new focused tests
  in `tests/simple-excel-import.test.ts` covering mixed final-expiry and
  manufacture rows, ISO dates, leading zeros and rejected calendar dates.
- `npm run typecheck`: PASS.
- `npm run check:context`: PASS.
- `npm run test:harness`: PASS, 6 tests.
- `git diff --check`: PASS, no whitespace errors.
- Direct parser run against the owner's format and against the generated
  template file: the four template rows resolve to `2025-09-01`, `2025-06-15`,
  `2026-03-10` and `2025-09-20`; a file with two bad rows reports both Excel
  row numbers and imports nothing.
- The browser import dialog was not exercised against the live site, and the
  production deployment was not started. The change is confined to the parser,
  so the existing preview and API path are unchanged.

## Result and handoff

The final expiry date is preserved for rows without a shelf life, matching the
import dialog text and the accepted plan. The legacy tab-separated format keeps
its unknown-expiry semantics. Both are covered by focused tests.

Next step: the owner uploads the prepared table through "Добавить" ->
"Импорт из Excel" on the site. Production still runs the pre-fix revision until
this branch is merged and the owner starts the deployment workflow by hand.
