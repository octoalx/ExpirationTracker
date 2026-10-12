# Simple Excel product import

## Goal and acceptance criteria

Import a first-sheet table with a header row and fixed columns: barcode, name,
date, optional shelf life in months. Row order is unrestricted. Blank months
mean final expiry; positive whole months mean manufacture date. Preview shows
final expiry and import stores it for the authenticated owner, including an empty inventory.
Existing inventory and catalog formats remain supported.

## Scope and approach

Share the Excel parser with the preview, add simple-table parsing, and validate
the API payload before transactional writes. Reuse UTC month arithmetic.

## Risks and invariants

Validate calendar dates and month ranges; clamp month ends. Preserve text barcode
leading zeros and optional quantities/dates. Reject malformed rows before import.
No schema changes, startup jobs, live integrations or production operations.

## Verification

Focused parser and API tests, existing inventory tests, TypeScript check and diff review.

## Result and handoff

Implemented shared parsing, expiry preview and validated transactional API writes.
PASS: 15 focused tests, including disposable SQLite empty-inventory import,
ownership, malformed-payload atomicity, legacy formats and calendar boundaries.
PASS: TypeScript and diff whitespace checks. Browser interaction was not exercised.
Manufacture dates and months are used to calculate expiry; only final expiry is imported.
