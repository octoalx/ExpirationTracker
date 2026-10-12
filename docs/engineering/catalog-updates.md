# Shared scanner catalog updates

The scanner reads `SharedCatalogEntry`, shared by all users. Only administrators
write this reference. `Product` is each user's inventory and is not modified by
catalog updates.

## Original DBF bundle

Use **goods.dbf** and **barcode.dbf** from the same complete export. The other
15 files in the supplied Copyright Base bundle are not required. Do not upload
CDX indexes, SDB device files, Doc.DBF, Pos.DBF or sprav.dbf.

In the administrator account, open Catalog, choose the two files, select the file
check action, review the counts and sample, then save the catalog. Keep the tab
open until the success message. No conversion or manual splitting is required.

`goods.dbf` supplies NAME; `barcode.dbf` supplies BARCODE. Join records by ARTICUL
and IDSET, never by position. The supported format is dBase III (version 0x03),
Windows-1251 (language driver 0xC9), up to 1,000,000 records and 256 MiB per file.
Parsing runs locally in a browser worker; original files are not stored on the
server. Unknown formats, broken records, missing names or counterpart records,
and conflicting names for one barcode reject the preview before any writes.
Deleted DBF records are skipped; identical barcode/name duplicates are collapsed.

## Save behavior

Saving uses the authenticated administrator API in 500-entry batches. An existing
barcode receives its new name; a new barcode is inserted. Codes absent from the
new export remain available. The database enforces a unique barcode. Existing
user inventory and the ordinary user Excel import are independent.

A failed connection can leave already confirmed batches saved. Repeat the same
pair: upserts do not create duplicates. There is no automatic deletion or full
database replacement. Excel and CSV catalog import remain available as alternatives.

## Maintenance

Parser: `src/lib/catalog-dbf.ts`; worker: `src/lib/catalog-dbf.worker.ts`;
UI: `src/components/CatalogImport.tsx`; API: `src/pages/api/admin/catalog.ts`.
Run `npm run test:app`, `npm run typecheck`, and the release gate before deployment.
Verify worker loading and a small paired-file save using disposable storage.
The personal `expirationtracker-catalog` skill points to these maintained sources.
