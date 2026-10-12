# Product catalog, barcode scanning, and legacy inventory import

## Goal and acceptance criteria

- Import the supplied Windows-1251 semicolon-separated catalog (106 products plus a numeric total footer) into a persistent catalog owned by the authenticated user.
- Resolve an exact barcode to its catalog name while adding a product. Preserve separate batches and optional expiry dates and quantities.
- Support the owner's selected scanning devices, with clear unknown-barcode and camera failure states.
- Preview and import the supplied tab-separated inventory (429 rows) without losing dates or interpreting ambiguous fields silently.
- Preserve Excel import and existing ACTIVE/ARCHIVED/DEFECT behavior.

## Scope and approach

Add an incremental Prisma catalog migration, session-scoped lookup/import endpoints, validated text parsing, and catalog/scanning controls in the existing add/import dialogs. Keep source files outside the repository. Provide a reviewable import preview before inventory mutations.

## Risks and invariants

- Owner confirmed: omit OLD rows; dates are manufacture dates; final numbers are shelf life in months; scan using a phone camera. Blank shelf life remains unknown (null expiry).
- Catalog ownership follows session identity. Do not expose another user's records or accept client-supplied ownership.
- Barcode strings retain leading zeroes. Reject conflicting duplicates rather than choosing a name silently.
- No production storage, notifications, or deployment are authorized by this local implementation task.
- Camera access requires HTTPS or localhost and explicit user initiation. Stop video tracks on closing or unmounting.
- The existing Excel import assigns today's date to every row. Replace fabricated dates with validated explicit dates or null.

## Verification

Run parser and import/lookup behavioral tests, including malformed rows, encoding, leading zeroes, duplicate conflicts, date boundaries, and ownership. Check the incremental migration on disposable SQLite with an existing record and verify preservation. Run typecheck and review the diff. Verify scanning UI with isolated settings; report physical-device limitations explicitly.

## Result and handoff

Implemented catalog schema/migration, session-scoped lookup/import API, validated UTF-8/Windows-1251 CSV parser, preview/import control, and camera barcode scanning with ZXing. Recognition stops camera tracks and looks up the name; the owner supplies the batch date/quantity and submits the existing product form. Unknown barcodes remain manually editable. Camera startup is explicit, uses the rear-facing preference and local decoding, and handles permissions/HTTPS failures. Closing, unmounting and hiding the page stop the stream. Mobile dialogs scroll within the viewport.

TXT import previews rows and calculated expiry dates. It excludes OLD and preserves optional quantities as null. Month arithmetic clamps the day at month ends and runs in UTC. Existing Excel import now stores null when no expiry is supplied, rather than inventing today's expiry. Validation rejects the entire payload before writes, and a Prisma transaction makes the import atomic.

Source evidence: 106 catalog products; 429 inventory rows; 157 OLD excluded; 272 included, with 169 calculated dates and 103 unknown expiry dates. The catalog footer is accepted only when its numeric count matches the product row count. Original source files remain outside Git. An Excel artifact containing all 272 included rows, manufacturing dates, shelf-life months and formula-driven expiry dates was saved in the owner's Downloads folder.

Fresh verification:
- `npm run test:app`: PASS, 13 tests (startup isolation, parsers, date boundaries, real disposable SQLite API integration).
- API integration applies historical migrations, seeds an existing batch, applies the new migration and verifies preservation, owner isolation, unauthorized access, catalog upsert idempotency, explicit/unknown expiry dates and atomic rejection of invalid rows.
- Inventory tests under America/New_York: PASS, 4 tests; calculations do not depend on host timezone.
- `npm run typecheck`: PASS.
- Isolated Next.js production build: PASS after explicitly installing the ZXing peer library; background jobs disabled and database URL points to verification storage.
- `npm run check:context` and `npm run test:harness`: PASS.
- Excel exported XML independently reconciled against all 272 source rows: PASS, string barcodes, 169 correct dates, 103 blank expiry results. Formula error scan found none. Renderer preview was inspected; the bundled renderer displays date serials/scientific barcode notation despite correct XLSX types and number formats. Native Excel rendering/recalculation is unverified.
- Physical phone camera remains unverified. Production migration, catalog and inventory import completed on 2026-10-02; see the deployment plan for runtime checks and recovery.

## Operator workflow

Deployment and initial import are complete. For future imports, sign in as the intended owner. Open Add product, expand the CSV catalog control, select the original CSV, review and save 106 entries. Open Excel / TXT import, select the original TXT, review 272 included rows and 103 unknown expiry dates, then import. Repeating inventory import creates additional batches; it is not an upsert. To add a batch by camera, scan, verify the resolved name, supply expiry (or manufacturing date and shelf life) and quantity as needed, then select Add product.

