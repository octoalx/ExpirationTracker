# Administrator DBF reference updates — 2026-10-03

## Goal and acceptance criteria
Administrators independently update the scanner reference using only goods.dbf
(names) and barcode.dbf (barcodes) from the same legacy export. Ignore the other
15 files; join by ARTICUL + IDSET, never by row position. Show source counts,
joined unique entry count and sample before saving. Preserve text codes/Cyrillic,
skip DBF deleted rows, collapse identical duplicates, and reject corrupt files,
missing joins or conflicting names before the first server write. Existing shared
names are updated by barcode, absent codes retained, and private Product untouched.
Create a discoverable personal skill with these maintained format/workflow facts.

## Scope and approach
Browser-only DBF parser in a worker to keep the admin UI responsive. Reuse admin
batch API and 500-entry upserts; raw DBF files never enter server storage. Add
operator instructions on the Catalog page; preserve Excel/CSV and user inventory
import. Create skill outside repository in the personal Codex skills directory.

## Risks and invariants
Full source validation occurs before writes. A later network failure may leave
confirmed batches; repeating upserts resumes safely without duplicates. Do not
silently delete missing codes or change private inventory. No notification or
startup side effects in tests. Unknown DBF versions/encodings fail explicitly.
No source database or credentials enter Git or skill files.

## Verification
Behavioral DBF fixtures for join order, source fields, CP1251, leading zeros,
deleted rows, duplicate conflicts, truncation, schema and missing counterpart.
Parse the full supplied pair on isolated resources; reconcile all 444,297 names
against existing CSV and verify hashes unchanged. Fresh TypeScript and release
checks; production worker bundling and isolated runtime before rollout if deployed.
Skill validator and documentation/context checks. No physical-phone claims.

## Result
Completed and deployed within the previously authorized expiry.axnode.xyz task.
Fresh verify:release PASS: 49 application tests, 3 harness tests, TypeScript and
context checks; no skipped required checks. Skill quick_validate PASS.
The full paired DBF parser produced 444,297 entries, exactly matching every CSV
barcode/name; source file hashes stayed unchanged (local parse 2.41 seconds).
Local browser worker full preview and two-record save PASS on disposable storage.
Actual Linux production bundle also processed the full pair in the browser and
saved a two-record pair through the admin UI on an isolated restored production
snapshot. Existing inventory/settings/legacy data remained unchanged. Normal
startup on the sanitized full snapshot preserved all six table fingerprints.
No real integrations or background jobs were enabled in rehearsal.

Release source SHA-256:
e15e1cd9fc2a8d1e9f4f1f6f51d17721c4a81f69b4b8245dc75f0e4a6b452570.
Deployed image expirationtracker-dbf:20261003:
sha256:8ce82c4805a45e2edc8834e602dd5286ccd9173f3804889dd075a6caee10ca79.
Exact build source/evidence outside server checkout:
/home/Alex/.codex-releases/expirationtracker-dbf-20261003.
No new database migration or source reimport was necessary for the DBF UI change.
All six production table fingerprints were identical before/after app switch:
User 3, Product 459, legacy CatalogEntry 106, Settings 2, Account 0,
SharedCatalogEntry 444,297. SQLite integrity OK. App healthy; nginx config valid;
HTTP sign-in/assets, anonymous denial, ADMIN/USER lookup and USER write denial PASS.
Authenticated production loopback lookup: median 4.86 ms, p95 54.80 ms, 100 samples.
Public HTTPS still returns the expected Cloudflare Access 302. Access login and
physical camera/public-network timing were not tested.

Recovery: retain expirationtracker-rollback:pre-dbf-20261003 and consistent full
pre-dbf-switch/post-dbf-switch SQLite backups. Roll back the image tag and recreate
only app/reload nginx if needed; do not overwrite live storage. Old backups are
archived outside the checkout, not deleted. Temporary local build/rehearsal files
are archived outside the project. Original 17 source files and verified CSV remain.
No Git commit/push, checkout reset, manual live notifications or unrelated cleanup.

Administrator steps and semantics: docs/engineering/catalog-updates.md.
Personal skill: C:/Users/Alex/.codex/skills/expirationtracker-catalog/SKILL.md.
