# Scanner catalog deployment and workspace cleanup — 2026-10-03

## Authorized goal and acceptance
Owner explicitly authorized deployment and full catalog import on expiry.axnode.xyz,
and cleanup of work-related clutter. Target: Alex@146.103.42.228:34657,
/home/Alex/ExpirationTracker. Do not modify unrelated services or owner changes.
All 444,297 source barcode/name entries resolve in SharedCatalogEntry, with unique
barcodes and existing admin reference entries retained if absent from source.
User/Product/Settings/private legacy rows stay unchanged. Admin writes only.

## Scope and recovery
Package HEAD plus explicit current source changes into a SHA-256 identified archive.
Build an independently tagged image using verified compatible dependency layers.
Take a consistent online SQLite backup, rehearse normal migrations/startup and
complete import on its disposable copy with jobs disabled and integrations cleared.
Retain current image and pre-switch backup. Apply only additive migration, import
with unique barcode upserts, then replace app only and reload nginx. If health
fails, restore old image tag without overwriting live data. Verify source coverage,
existing row fingerprints, auth boundaries and real server search timings.

## Cleanup
Inventory local and server work artifacts first. Preserve raw Copyright Base files,
full catalog CSV, extraction report, source code/plans, live data and one recent
pre-switch backup/rollback image. Remove redundant generated exports/chunks if
full CSV verification passes, disposable copies, obsolete release scratch logs and
work build artifacts. Never reset server checkout or prune unrelated Docker assets.

## Verification
Fresh verify:release; Linux build and isolated normal-entrypoint rehearsal;
source/name coverage and uniqueness; no existing-row changes; indexed lookup and
HTTP latency on server; health/assets/anonymous denial. Phone camera remains manual.

## Result
Fresh local verify:release PASS: 45 application tests, 3 harness tests,
TypeScript and context. Dependency lock deep-equality check against retained Linux
builder passed. Source archive SHA-256 41421ef0d38b327a716ae09691055c56b49399bf45e48d69680af7ff225e660c;
source JSONL SHA-256 a8e33f0a236cfcabc8193090af49dbd5bc17e686365970875019dd4e986e4cfb.
Candidate is building outside the server project at
/home/Alex/.codex-releases/expirationtracker-catalog-20261003.
Cleanup will remove only reproducible local exports/chunks/duplicate archive and
scratch builds, while older server recovery files will be moved outside the project
instead of deleting database backups. Current live data and latest rollback remain.

Linux candidate image: sha256:35be9851f027d3fa051e6cccd4838fa7ae4e73c516d0c1beba20d142834458ce
(config sha256:017751e045314cb209e286f0dd9f60bdfb3644a1abb838f25b0feb776d1ae529).
Normal-entrypoint rehearsal on sanitized snapshot PASS: migration, complete import,
repeat import, original data fingerprint preservation, real admin/employee login,
shared lookup, employee write denial, legacy POST denial, sign-in/admin shell and
10 assets. Snapshot import/reimport totals both 444,297 unique rows; all 106 legacy
admin codes occur in the source. Isolated authenticated HTTP median 6.26 ms/p95
54.96 ms under 0.5-CPU test limit, excluding camera/public network.
Local generated artifacts were archived to
C:/Users/Alex/.codex/work-archives/ExpirationTracker/20261003-catalog.
Older server releases, scratch checks and obsolete backup copies were archived to
/home/Alex/.codex-work-archives/expirationtracker-20261003.
No source checkout reset, history rewrite, Git commit/push or unrelated image prune.

## Production result
Additive migration 20261003000000_add_shared_catalog applied. Complete source
import PASS: 444,297 rows, 444,297 distinct barcodes, zero missing/mismatched names;
all 106 old admin codes covered. Existing user/product/settings/account/legacy
catalog rows preserved. Production SQLite integrity OK. Import took 19.8 seconds.
Switched only app to the candidate image and reloaded nginx (configuration valid).
App healthy, sign-in and nine assets returned 200. Anonymous lookup denied;
ADMIN and USER shared lookups passed; USER import denied. Authenticated loopback
HTTP over 100 requests: median 4.48 ms, p95 55.19 ms, p99 113.31 ms. Indexed raw
SQL p95 0.028 ms. Camera and public-phone network are not included. Public HTTPS
returns the expected Cloudflare Access redirect (302); Access login/phone camera
remain owner checks. Short-lived signed sessions were created only in memory
inside the app container for production HTTP checks, with no credential changes.
Retained consistent pre/post full SQLite backups in project backups/; old backups
archived outside project. Current previous image retained under
expirationtracker-rollback:pre-shared-catalog-20261003 (c64219e2c0a2).
Production operator evidence/source snapshot are outside the checkout in the
.codex-releases directory. Existing modified server checkout was preserved.
No deploy.sh, Git commit/push, live manual email/Telegram or unrelated cleanup.

Final post-switch reconciliation: User (3), CatalogEntry (106), Settings (2) and
Account (0) have identical full-row fingerprints to the pre-switch backup. All
remaining Product rows retain every original column. Product count is now 459:
one concurrent owner-scoped DELETE /api/products request returned 204 at
2026-10-03 15:13:57 UTC after the image switch. That legitimate live deletion was
verified against nginx access logs and was not undone. The importer transaction
itself preserved private-table fingerprints. Full pre/post backups have integrity
OK; only these two recent consistent backups remain in project backups/.
Local verification scratch files were also moved outside the checkout after the
final checks; deployment source/evidence is retained in external archives.
