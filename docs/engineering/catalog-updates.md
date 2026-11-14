# Shared scanner catalog updates

The scanner reads `SharedCatalogEntry`, shared by all users. It is the only barcode
catalog: there is no personal catalog, and `GET /api/catalog` reads nothing else.
Only administrators write this reference, and only through the DBF pair below. `Product` is each user's inventory and is not modified by
catalog updates.

## Original DBF bundle

Use **goods.dbf** and **barcode.dbf** from the same complete export. The other
15 files in the supplied Copyright Base bundle are not required. Do not upload
CDX indexes, SDB device files, Doc.DBF, Pos.DBF or sprav.dbf.

In the administrator account, open Catalog, choose the two files and press
"Сохранить каталог". Both files go to the server in one request, are parsed and
validated there, and are then written. Keep the tab open until the success message.
No conversion or manual splitting is required.

`goods.dbf` supplies NAME; `barcode.dbf` supplies BARCODE. Join records by ARTICUL
and IDSET, never by position. The supported format is dBase III (version 0x03),
Windows-1251 (language driver 0xC9), up to 1,000,000 records and 256 MiB per file.
Parsing runs on the server. The upload is streamed to a temporary file that is
deleted when the request ends; the files are not kept. Unknown formats, broken
records, missing names or counterpart records, and conflicting names for one
barcode reject the upload before any write.
Deleted DBF records are skipped; identical barcode/name duplicates are collapsed.

## Save behavior

The server writes in 500-entry batches, one statement per batch. An existing
barcode receives its new name; a new barcode is inserted. Codes absent from the
new export remain available. The database enforces a unique barcode. Existing
user inventory and the ordinary user Excel import are independent.

A failed request can leave already confirmed batches saved; the error reports
their count. Repeat the same pair: upserts do not create duplicates. There is no automatic deletion or full
database replacement. CSV and Excel catalog import no longer exist.

## Maintenance

Parser: `src/lib/catalog-dbf.ts`; upload handling: `src/lib/server/catalog-upload.ts`;
wire format: `src/lib/catalog-upload-format.ts`; UI: `src/components/CatalogImport.tsx`;
API: `src/pages/api/admin/catalog-upload.ts` (the JSON `src/pages/api/admin/catalog.ts`
remains for tests and tools). nginx gives this path its own `client_max_body_size 520m`
in `nginx/nginx.conf` and `nginx/nginx-ssl.conf.example`; check that the deployed
config contains it before a large upload.
Run `npm run test:app`, `npm run typecheck`, and the release gate before deployment.
Memory grows with the row count: about 0.9 GB peak for 443,701 rows and 1.7 GB for
1,000,000 rows measured locally. Check the production host's free memory before a
large upload.
The personal `expirationtracker-catalog` skill points to these maintained sources.
