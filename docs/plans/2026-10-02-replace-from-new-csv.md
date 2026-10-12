# Replace working inventory from the new CSV

Date: 2026-10-02

## Goal and acceptance criteria

The owner supplied a new SROKI.csv and explicitly requested replacing the working site's existing product table with every source record. Dates with shelf-life months are manufacture dates; dates without months are final expiry dates. Preserve every source batch, including duplicate barcodes. The previous OLD exclusion preference persists, but this file has no OLD markers.

Accept only fully validated rows and independently reconcile every final date. Replace the current owner's entire product inventory, including separately added rows, rather than append to it. Preserve catalog, owner and settings. The final product multiset must match the new CSV exactly and contain no missing dates.

## Approach, risks and recovery

Decode Windows-1251, parse semicolon CSV and validate all rows before any production mutation. Generate a source payload with file hash and full source metadata. Check the current owner and data, create a fresh online SQLite backup and rehearse replacement on a disposable copy. Delete only captured product IDs scoped to the verified sole owner and insert the new records in one transaction. Refuse changed snapshots or repeated execution. Verify source equality, catalog preservation, integrity and service health.

The new request supersedes the earlier partial replacement: existing inventory rows are removed. No schema migration, application deployment or notification send is required. Retain a restricted receipt containing old rows and replacement IDs for scoped reversal if needed; never routinely restore over live data.

## Verification

Validate CSV columns, encoding, row count, calendar dates, months and batch multiplicity. Independently calculate every expiry. Run existing date tests. Check backup integrity, disposable rehearsal, transaction result and read-only reconciliation against the source after replacement.

## Result

Completed the authorized full inventory replacement on 2026-10-02. Source SHA-256: 5e95195458b9ff37307f6daf28affa4e275e4ee7fdc315ab60d6581341869e23. Windows-1251 CSV contains 436 records: 267 manufacture dates with months, 169 direct expiry dates, no OLD markers. All dates and months passed validation and independent date arithmetic reconciliation. One record has no barcode (Grunt Typhoon Master No. 103 Beton-contact, 1.4 kg); retained an empty barcode as supplied. Repeated barcodes/batches were preserved without deduplication.

Created restricted online backup backups/pre-new-csv-replacement-20261002.db and rehearsed on backups/new-csv-replacement-rehearsal-20261002.db. Replaced all 275 prior owner products with all 436 source records atomically. The owner's new full-table replacement request superseded preservation of the three separate products in the earlier correction. All 106 catalog records remain unchanged; owner/settings were not modified.

Disposable rehearsal, transaction checks and subsequent read-only reconciliation PASS: 436 imported records, zero missing expiry dates, exact source barcode/name/expiry/quantity/status multiset, no previous IDs retained, catalog preservation and SQLite integrity. Seven date/UI regression tests PASS in the normal timezone and America/New_York. Operator scripts passed syntax review. No application code, schema or deployment changes were needed. Service healthy; sign-in HTTP 200. Physical browser inspection of the authenticated table was not performed.

Restricted recovery receipt backups/new-csv-replacement-20261002.json retains all previous rows and inserted IDs for scoped recovery. Repeat execution and changed snapshots are rejected. No live notifications were sent.
