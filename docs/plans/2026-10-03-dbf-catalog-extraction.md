# DBF barcode reference extraction — 2026-10-03

## Goal and acceptance criteria
Read the supplied legacy database without modifying it. Identify product-name and
barcode relationships, export a readable complete reference, and reconcile all
source barcode rows with exported or excluded rows. Preserve text barcodes and
Cyrillic. Keep conflicting and invalid records available for review. Determine
compatibility with the existing admin import; do not deploy or write live data.

## Scope and approach
Read DBF headers and fixed records, join goods.dbf and barcode.dbf using ARTICUL
and IDSET if confirmed by data, export UTF-8 CSV plus an extraction report in the
ignored Copyright Base directory. Retain a repeatable extraction script.

## Risks and invariants
Deleted rows, duplicate keys, ambiguous names, absent joins and unsupported codes
must be counted explicitly. Never infer a name from row order. Original files
remain untouched. No credentials, startup instrumentation or notifications.

## Verification
Reconcile record counts, reread CSV, verify joins and source hashes, check context
and harness for documentation/tooling changes, review diff.

## Result and handoff
Exported 444,297 unique barcode/name entries into Copyright Base/Export/barcode-catalog.csv,
plus complete raw CSV copies of all five DBF tables and a JSON reconciliation report.
The join uses ARTICUL + IDSET. No missing keys, deleted rows, invalid codes or
conflicting names. Barcode lengths: 442,943 of 13 digits; 1,338 of 12; 16 of 14.
Goods/barcode/sprav use Windows-1251; Doc/Pos use CP866 (confirmed by Cyrillic text).
Initial strict decoding rejected CP866 Pos data; corrected per-table encoding,
without replacing undecodable bytes. The extraction script verifies CSV roundtrip
and unchanged source SHA-256 hashes. No live data writes or deployment.
Current website import is Excel-only and limited to 10,000 rows; the complete
reference requires a separate bulk CSV import implementation before site loading.

Cleanup handoff: raw CSV copies, duplicate source ZIP and split files were moved
to the external local work archive. Copyright Base retains all 17 original files,
the complete barcode-catalog.csv, extraction report and instructions. They remain
excluded from Git and Docker build contexts.
