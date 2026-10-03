# Correct source inventory dates

Date: 2026-10-02

## Goal and acceptance criteria

Replace the previous SROKI inventory import using the owner's clarified date semantics: add shelf-life months when present; otherwise use the source date as expiry. Every imported row must have a valid expiry date. Preserve independently added products, catalog entries, ownership and settings. The owner confirmed excluding 157 OLD rows and importing 272 rows.

## Approach and risks

Correct and test the local parser. Reconcile the previous payload against production using names, barcodes, dates and the initial import timestamp, refusing ambiguous matches. Take a consistent online SQLite backup, rehearse the atomic replacement on disposable storage, then replace only matched initial-import rows in a transaction. Recheck source multisets and all unrelated rows. Keep a receipt of inserted IDs and refuse a repeated operation. No application deployment, schema change or live notification send is needed.

Dates without months were previously discarded. The source date column has mixed semantics; no expiry date may be guessed. Recover through a scoped reverse transaction using saved rows and replacement IDs if needed; never restore over live data routinely.

## Verification

Run date parsing regression tests, timezone checks and TypeScript checking. Independently reconcile every corrected source date. Verify backup integrity, disposable replacement, source equality, unrelated row preservation and service health after the authorized production operation.

## Result

Completed the authorized production replacement on 2026-10-02. Initial import was identified by its exact timestamp (2026-10-02T12:16:08.609+00:00) and full barcode/name multiset. All 272 rows were present; three had manually edited dates. As requested, replaced the entire initial import with source-derived values, including those edited dates. Preserved all three separately added products byte-for-byte and all 106 catalog entries.

169 manufacture dates plus months retain their original calculated expiry; 103 blank-month rows now use the explicit source date as final expiry. Every one of the 272 replacement rows has a date. Total production products: 275. No schema change, app restart or deployment was performed.

Before replacement, created a consistent online backup at backups/pre-source-date-correction-20261002.db, checked integrity and rehearsed on backups/source-date-correction-rehearsal-20261002.db. Atomic replacement and subsequent independent read-only checks passed source equality, unrelated row preservation and SQLite integrity. Restricted receipt backups/source-date-correction-20261002.json retains previous rows and replacement IDs for scoped recovery. The operator script refuses repeated replacement and stale snapshots.

Verification: seven inventory tests PASS in the normal timezone and America/New_York; typecheck PASS; all 272 source dates independently reconciled PASS. Production service healthy and sign-in HTTP 200. No live notifications were sent; settings remain disabled. Local parser/tests updated; permanent Excel behavior unchanged.
