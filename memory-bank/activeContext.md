# Active context

## Owner acceptance — 2026-10-03
- Owner confirmed all outstanding phone camera, mobile form/navigation and public
  Cloudflare Access checks work correctly. Physical-device acceptance is complete.
- Owner requested committing the remaining catalog changes; no push requested.

## 2026-10-03: administrator DBF updates deployed
- expiry.axnode.xyz runs expirationtracker-dbf:20261003;
  image 8ce82c4805a45e2edc8834e602dd5286ccd9173f3804889dd075a6caee10ca79.
- Admin → Catalog now accepts goods.dbf + barcode.dbf from the same export.
  Worker joins ARTICUL + IDSET, validates the whole pair, previews counts/sample.
  Other 15 files are unnecessary. CSV/Excel and user inventory import remain.
- Save uses 500-entry admin batches: insert new codes, update matching names,
  retain absent codes; repeat safely without duplicates. Private Product untouched.
- SharedCatalogEntry retains 444,297 unique codes. All six production table hashes
  unchanged across switch; Product 459, User 3, legacy CatalogEntry 106, Settings 2.
- Release gate PASS: 49 app + 3 harness tests, TypeScript/context, skill validation.
  Full DBF/CSV reconciliation and actual production browser worker/save passed on
  isolated restored storage. Background jobs/integrations disabled in rehearsal.
- Production healthy; authenticated role checks/assets passed. Loopback lookup
  median 4.86 ms/p95 54.80 ms; owner confirmed public Access and phone camera.
- Recovery image expirationtracker-rollback:pre-dbf-20261003; current pre/post
  consistent SQLite backups retained, older work archived outside the checkout.
- Original 17 DBFs/support files and full verified CSV remain in ignored Copyright
  Base. Temporary verification/build files archived outside local project.
- Personal skill: C:/Users/Alex/.codex/skills/expirationtracker-catalog/SKILL.md.
- Modified server checkout preserved; source/evidence in
  /home/Alex/.codex-releases/expirationtracker-dbf-20261003. No commit/push.
- Details: docs/plans/2026-10-03-admin-dbf-catalog.md;
  operator guide: docs/engineering/catalog-updates.md.

## Mobile inventory UI — 2026-10-03
- Removed phone multi-selection; added an always-visible single-tap delete button using the existing delete API handler (owner requested removing confirmation).
- Moved the page-size selector to its own mobile row without the desktop separator; desktop selection remains available.
- Verification: typecheck PASS; mobile-product-flow and product-urgency-render 5/5 PASS; diff whitespace check PASS. Owner confirmed real-device behavior.
- Mobile fix committed as 425e0e0. Fresh release gate PASS: 49 application + 3 harness tests, typecheck/context. Deployed on verified Alex@146.103.42.228:34657; 91.108.249.220:54783 is unrelated stale SSH configuration and must not be used. No push.
- Mobile release 425e0e0 deployed over preserved DBF source. Healthy image 060a0334c43aa2eb84107db988be70872796dabdf17e7982b47027012e0630ca; isolated auth/pages/assets and production HTTP/API checks PASS; all six live table fingerprints unchanged, integrity OK (463 products, 444297 shared codes). Rollback expirationtracker-rollback:pre-mobile-425e0e0 and restricted final backup retained. Details: docs/plans/2026-10-03-mobile-delete-deployment.md.
