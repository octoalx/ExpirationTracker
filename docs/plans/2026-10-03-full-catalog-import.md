# Full scanner catalog import — 2026-10-03

## Goal and acceptance criteria
Prepare all 444,297 extracted entries for admin-only shared catalog import.
Validate the full source before writes, submit bounded batches, and upsert by the
unique barcode so existing entries do not become duplicates. Preserve entries
absent from the source. Show progress and allow safe retry after partial failure.
Measure indexed exact lookup on a disposable full-size SQLite database, including
Prisma overhead. Report target import separately from prepared/tested tooling.

## Scope and approach
Support CSV in the admin importer, validate up to 500,000 CSV rows, send batches
of 500 through the existing admin API. Also generate 5,000-row source chunks.
Use the existing barcode unique index and shared-only scanner lookup.

## Risks and invariants
Names in this source replace existing names for matching codes. Each batch is
atomic; whole import is resumable via repeatable upserts, not globally atomic.
No user Product changes. Missing target/database access must not be mistaken for
a completed site import. No background jobs or live integrations during checks.

## Verification
CSV limits, invalid/conflicting rows before writes, repeated API upserts, existing
entry preservation, and indexed query plan/full-size benchmark on disposable data.
Typecheck, focused tests, context and harness checks, diff review.

## Result and handoff
Prepared 89 verified CSV parts (88 x 5,000 and 1 x 4,297), and admin full-file
CSV import using sequential 500-entry requests with progress and safe restart.
Client validates the complete file before any request; server retains the 10,000
row per-request limit. Preview renders only 100 rows to bound DOM work.
Full-size local benchmark: 444,297 unique rows, SQLite file 90,562,560 bytes;
indexed query plan confirmed. 2,000 mixed found/missing Prisma lookups: median
0.240 ms, p95 0.329 ms, p99 0.438 ms. First Prisma query 81.2 ms includes client
startup. Raw SQL p95 0.080 ms. 500 Prisma upserts: 475 ms. Local warm database,
not an HTTP/camera/network/production measurement. Evidence remains ignored at
.verification/catalog-benchmark.json. Benchmark uses disposable temporary storage.
Release verification PASS: 45 application tests, 3 harness tests, typecheck and
context. Existing-entry preservation strengthened in the API regression test.
Read-only inspection of the previously documented host: 460 Product rows,
106 CatalogEntry rows, SharedCatalogEntry absent. Production image c64219e2c0a2.
Owner authorized deployment on expiry.axnode.xyz; rollout details and final
evidence are in docs/plans/2026-10-03-catalog-rollout-cleanup.md.
Before rollout: consistent SQLite backup, copy rehearsal preserving original
rows; merge existing admin catalog into shared reference, reject ambiguous
legacy names; source wins for matching barcodes, preserve unrelated entries.
Verify complete source/name coverage and uniqueness after import. Roll back image
using retained current tag; leave additive table in place; never restore over live
writes routinely. Existing JSON backup format does not include shared reference;
retain consistent full SQLite backup and source CSV for recovery.

Cleanup: split CSVs are archived outside the project; the verified full CSV and
chunked admin import are the retained primary workflow.
