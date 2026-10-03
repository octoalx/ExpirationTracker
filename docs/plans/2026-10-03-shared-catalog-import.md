# Shared barcode catalog import — 2026-10-03

## Goal and acceptance criteria
Administrators import inventory and product-catalog Excel documents into a shared
barcode/name reference, with preview and validation before writes. All authenticated
users can resolve imported names through the existing scanner lookup. Only the shared reference is used for scanner lookup. Reimport updates names without creating batches.
Non-admin writes are rejected. Existing inventory and legacy catalog storage survives but is unused.

## Scope and approach
Add a separate SharedCatalogEntry table and incremental migration, admin POST API,
Excel preview in a new admin tab, and shared-only lookup in the existing catalog GET API.
Reuse the existing Excel parser and catalog validation.

## Risks and invariants
Preserve leading zeroes where stored as text/formatted cells. Invalid barcodes and
conflicting names reject the import atomically. Only verified admin sessions write
shared data; private data stays user scoped. No startup or live integrations.

## Verification
Disposable SQLite migration/data preservation and API authorization, isolation,
shared-only lookup, reimport and invalid payload tests; both Excel formats; TypeScript check;
diff review. No production migration or deployment authorized.

## Result and handoff
Implemented shared reference migration, admin import with preview and both Excel
formats, and authenticated shared-only scanner lookup. User catalog writes are disabled.
PASS: 9 focused catalog tests (including disposable migration preservation),
TypeScript, context check, 3 harness tests, and diff whitespace review.
Fixed the catalog test migration filter to exclude only the migration under test,
so the existing manufacturing-date migration is applied correctly.
No browser interaction or production migration/deployment performed. Numeric
Excel cells cannot recover leading zeroes already removed by the source file;
store barcodes as text. Existing backup/restore formats are unchanged and do not
include the shared reference; keep source Excel files for reimport.
