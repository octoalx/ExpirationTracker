# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and their store colleagues. Phones are the primary devices; desktop browser use remains supported.

## Product Purpose

Register store products quickly and track their expiration dates.

## Operating Context

The primary workflow starts with a barcode scan. A catalog supplies the product name. Users enter either an expiration date or a manufacturing date plus a shelf life expressed in days or months. Existing tracked records should be discoverable by scanning or searching.

## Capabilities and Constraints

- Preserve Russian product language and desktop workflows.
- Keep the existing Next.js Pages Router architecture for this redesign.
- Preserve optional dates and quantities and ACTIVE, ARCHIVED, and DEFECT semantics.
- Catalog identity and tracked inventory records are distinct concepts.
- Current APIs scope catalog and inventory to the verified session owner.
- Each account owns its inventory. People using the same account see that account's records; separate accounts have separate records.
- Scanning an existing inventory barcode shows matching records and their dates. Scanning a barcode absent from inventory opens registration, using the catalog name when available.
- A dedicated new-batch workflow is outside the requested redesign.
- Preserve existing shelf-life units, including weeks, unless a deliberate product decision changes them.

## Product Principles

- Make barcode scanning and quick registration primary tasks.
- Reveal only the date fields needed for the selected input method.
- Show the calculated expiration date before saving manufacturing-date input.
- Support manual barcode entry and clear recovery from camera or network failures.
- Preserve an efficient desktop table for reviewing many records.

## Brand Commitments

- The owner requests a light, precise, informative working tool for building supplies with a distinctive refined visual style.
- Dark themes are outside this redesign. Product photographs must not appear in the main inventory list.
- Green is not the preferred primary accent. Typography should combine refinement with practical readability rather than decorative luxury styling.

## Evidence on Hand

Source implementation in src/components/Layout.tsx, src/pages/dashboard.tsx, src/components/products/ProductTableEnhanced.tsx, src/components/AddProductForm.tsx, and src/components/BarcodeCamera.tsx. Current rendered screens have not yet been inspected for this redesign.
