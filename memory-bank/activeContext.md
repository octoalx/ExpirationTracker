# Active context

Updated: 2026-10-02

## Current milestone

Follow-up correction deployed: original Excel/manual-add flows restored; one-time file UI removed. Camera/catalog lookup retained. Missing expiry displays correctly in table/cards/edit form and is excluded from expired statistics/filter. See docs/plans/2026-10-02-restore-product-flows.md.
- 273 production products / 103 missing dates and 106 catalog entries preserved by full read-only row reconciliation.
- Fresh verify:release PASS with 15 application tests including actual table/card rendering. Isolated normal-entrypoint runtime and original Excel behavior PASS.
- Production app healthy, nginx HTTP 200, anonymous API HTTP 401 and Cloudflare Access preserved.
- Fresh backup backups/pre-flow-fix-20261002.db and rollback image expirationtracker-rollback:pre-flow-fix-20261002 retained.

Initial catalog and phone-camera lookup deployed to https://expiry.axnode.xyz at the owner's explicit request.
- 106 catalog entries and 272 ACTIVE inventory batches imported into the verified sole ADMIN account; 157 OLD rows excluded.
- Manufacture date plus shelf-life months determine expiry; 103 missing shelf lives remain null, quantities remain null. Full source reconciliation passed.
- Fresh verify:release passed, including 13 application tests, typecheck and tooling checks. Normal Linux entrypoint and authenticated APIs passed isolated testing without network or background jobs.
- Production app healthy, nginx HTTP 200, anonymous catalog HTTP 401, Cloudflare Access redirect preserved.
- Consistent backup retained at server backups/pre-catalog-20261002.db; previous image retained with rollback tag.
- No commit or push performed. Deployment source is archive-based. See docs/plans/2026-10-02-catalog-deployment.md for image identity and recovery.
- Physical phone camera and native Excel rendering remain unverified. Excel artifact is in Downloads.

## Operational context

VPS: Alex@146.103.42.228:34657. Repository: /home/Alex/ExpirationTracker. Dockerized Cloudflare tunnel routes to nginx; local nginx port 8881. Email OTP Access protects the public domain.

## Invariants and next verification

Private APIs derive ownership from verified sessions. Preserve barcode strings and optional expiry/quantity. Do not repeat inventory import unless additional batches are intended. Camera requires explicit start and HTTPS; tracks stop on close or page hiding. Production actions require task-specific authorization. Check camera scanning on the owner's phone.
