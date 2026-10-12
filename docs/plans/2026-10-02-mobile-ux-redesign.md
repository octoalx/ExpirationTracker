# Mobile-first inventory UX redesign

## Goal and acceptance criteria

Enable the owner and store colleagues to find or register an expiration-tracked product quickly on a phone while retaining desktop table workflows.

- Each verified account sees only its own inventory.
- Scanning a known inventory barcode shows all matching records and expiration dates.
- Scanning a barcode absent from inventory opens registration, prefilling the catalog name when available.
- Registration supports direct expiry input or manufacturing date plus shelf life, with a visible calculated expiry before saving.
- Preserve optional dates and quantities, existing shelf-life units, and ACTIVE/ARCHIVED/DEFECT behavior.
- The primary scan action is reachable without scrolling at 360–430 px; the mobile list needs no horizontal scrolling.
- Primary controls have at least 44 px touch targets; keyboard and safe-area handling are verified.
- Desktop retains sorting, selection, and bulk operations.

## Scope and approach

First show three independent visual concept boards covering home, scan results, and registration. The owner selects a direction before application UI implementation. An independent design reviewer assesses task hierarchy and subsequently the selected rendered UI.

Expected implementation targets: Layout, dashboard, mobile inventory presentation, AddProductForm, BarcodeCamera, shared UI primitives and global design tokens. Keep Next.js Pages Router and existing account-scoped APIs. A new-batch flow is outside scope.

## Risks and invariants

- Many implementation files already contain owner changes; preserve them and stage nothing implicitly.
- Distinguish catalog identity from tracked records and catalog absence from network failure.
- Never bypass ownership or modify scheduling, notification integrations, or production data.
- Prevent stale scan/lookup results and preserve input after failed saving.
- Verify calendar-month and leap-year boundaries if expiry calculations change.
- Image-generated concepts are visual proposals, not proof of runtime behavior.

## Verification

- Concept phase: inspect generated images for hierarchy and consistency; independent review is conceptual until images are inspected.
- Implementation phase: nearest behavior tests for scan routing and any changed date calculations; npm run typecheck; diff review.
- Runtime verification only with isolated development settings and fake integrations. Check mobile and desktop screenshots, keyboard, camera-denied/manual-entry recovery and data states.
- PASS: npm run typecheck; npm run test:app (20 tests); npm run check:context; npm run test:harness (3 tests); scoped git diff --check.
- PASS: focused scan/date tests in Europe/Minsk, UTC and America/Los_Angeles, including month ends, leap years, cleared dates and exact barcode matches.
- PASS: authenticated isolated browser flow: known barcode shows two matching records; absent barcode opens catalog-prefilled registration; manufacture date 2026-10-02 plus six months previews and saves 2027-04-02.
- PASS: mobile widths 360, 390 and 430 have no horizontal document overflow; desktop 1440 retains its table. Corrected full-screen panel translation and moved confirmations above phone navigation.
- PASS: source and actual mobile/desktop screenshot review by an independent reviewer; feedback about hidden lookup status and late responses overwriting manual names was addressed.
- PASS: mechanical design detector returned no findings on its bounded pass; fresh page reload produced no new console errors.
- FAIL, recovered for preview: isolated Prisma migrate deploy failed with a schema-engine error. The preview database was created from prisma migrate diff --from-empty SQL on disposable storage only; this is not migration-chain or release evidence.
- NOT VERIFIED: real phone camera decoding, hardware vibration, software keyboard behavior, safe-area behavior on physical devices, network ambiguity after a successful write, and production build/deployment. Camera-unavailable manual-entry fallback was verified.

## Result and handoff

The owner selected the merged light blue concept. Implemented the shared light shell, mobile inventory, unified scan routing, date-entry form, calculated expiry preview, local Manrope font, purposeful press/confirmation motion and optional vibration. Desktop table and existing owner edits are preserved. APIs, storage schema and background jobs were not changed for this redesign.

Live local preview uses localhost:3107 with background jobs disabled and disposable .verification/mobile-ux/preview.db data. Screenshots and seed fixtures are ignored verification artifacts. Follow-up: verify camera, keyboard, vibration and safe areas on the owner's phone before release.

### Visual feedback, 2026-10-02

The owner rejected dark styling and main-list product photographs. The requested revision combines the clarity of the light green concept with the typographic care of the warm concept, using a precise, informative work-tool character appropriate for building supplies. Green and decorative luxury styling are not preferred. A single merged light graphite/blue proposal is being shown before implementation; its accent and composition remain provisional until selection.
