# Active context

Updated: 2026-10-13
2026-10-13: CD dry run now passes; first real deploy still pending. The first dry
run failed because the backup step ran `bash scripts/release-backup.sh` from the
host tree, which on a first deploy is an older revision without that script. PR #12
(`7cd06f3`, merged `4d014c6`) delivers both helpers from the runner checkout to
`/tmp` on the host, so no step depends on the host carrying CD's own tooling. Dry
run 38361289000 succeeded: backup `expitrack-pre-deploy-20261013T103654Z-4d014c6cea40.db`
(98 MB, integrity ok), would deploy `4d014c6cea40`, rollback target `ded6d715`,
11 real dirty files so `allow_dirty` is still required. Host unchanged by the dry
run. Report: `docs/plans/2026-10-13-cd-helper-delivery.md`.

2026-10-13: Continuous delivery for production added on branch `local/cd-production`.
`workflow_dispatch`-only workflow with a `production` environment gate; sequence is
preflight -> backup -> deploy -> health check -> automatic rollback on failure.
Backup and health check live in `scripts/release-backup.sh` and
`scripts/release-healthcheck.sh`; `scripts/deploy-workflow.mjs` asserts the safety
properties in `test:harness`. Both scripts were exercised against the live host and
the host was restored to its prior state. Production is NOT deployed by this change:
the first run needs the owner's explicit command. Report and next steps:
`docs/plans/2026-10-13-cd-production.md`.

2026-10-06: Settings now save changed fields from the active tab, retain other
tab drafts and mark unsaved tabs. API accepts partial updates; disabled email
accepts incomplete recipient/port drafts, enabling validates retained values.
Password confirmation and shared threshold authorization preserved. All 90 app
tests, 3 harness tests, typecheck/context and focused diff checks passed. Browser
and deployment unverified. Plan: `docs/plans/2026-10-06-settings-partial-save.md`.

2026-10-06: Telegram/shared-store assistant deployed from exact uncommitted source.
One main store with explicit preview/confirm transfer, MANAGER/EMPLOYEE access,
inspection claims/versioned actions/audit, confirmed Telegram linking and durable
inbox/outbox. CRUD/import/stats/email/backup/restore use the new scope; restoring
pauses Telegram. Release gate passed 89 application + 3 harness tests and
context/typecheck; isolated build and responsive walk/action browser checks passed.
Production migration/transfer and @expitrackbot webhook registration completed;
app healthy, 434 shared + 3 private products preserved. Manager is existing ADMIN,
two empty department accounts are employees. Telegram unpaused, probe DONE; no
personal links yet. Webhook-only Access bypass added; parent policy unchanged.
Source archive 320d969fb214; old image/final backup retained. No commit/push.
Production evidence: `docs/plans/2026-10-06-telegram-production.md`. Activation:
`docs/engineering/telegram.md`; evidence: `docs/plans/2026-10-06-telegram-store-assistant.md`.

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

**First real CD deploy not done yet.** A dry run now passes (see 2026-10-13 above).
The real deploy needs `allow_dirty: true` because the host tree still differs from
`main` by 11 files; after the first successful deploy `.release-version` exists and
the tree matches HEAD, so `allow_dirty` is no longer needed. A real rollback has
never been executed — only its logic is unit-tested.

Private APIs derive ownership from verified sessions. Preserve barcode strings and optional expiry/quantity. Do not repeat inventory import unless additional batches are intended. Camera requires explicit start and HTTPS; tracks stop on close or page hiding. Production actions require task-specific authorization. Check camera scanning on the owner's phone.
2026-10-06: Committed pending changes as d4909d5 and mobile reset/date alignment
as f24d84f; deployed exact f24d84f archive to the verified VPS. 62 app tests,
3 harness tests, context/typecheck, Linux build and network-disabled representative
snapshot/startup/account-flow rehearsal passed. App healthy; every data table
except startup SystemLog matches before/after. Backup/rollback retained.
Blue filter-reset X was introduced in 4543a7f (Oct 5), not lost dialog fixes.
Production Chromium checks passed for settings/reset and add/edit date geometry;
actual iPhone picker remains unverified. No push. Details:
`docs/plans/2026-10-06-settings-deployment.md`.

2026-10-06: Account settings now validate name/email and allow password changes
with current-password confirmation and new-password repetition. Email conflicts
roll back profile/settings; session updates reload trusted database profile fields.
7 focused tests and typecheck passed. Full app suite: 61 passed, 1 failed because
catalog-api's mock lacks inventory-import from existing Excel work. Browser UI
and deployment were not exercised. Details: `docs/plans/2026-10-06-account-settings.md`.

2026-10-06: Added simple Excel import alongside inventory/catalog formats.
First row is headers; fixed columns are barcode, name, date, optional months.
Blank months mean final expiry. Shared parser drives preview; API validates all
rows before transactional owner-scoped creation and preserves unknown expiry.
Focused tests (15) and TypeScript passed. No deployment or live integrations.
Details: `docs/plans/2026-10-06-simple-excel-import.md`.

## Catalog upload UI — 2026-10-06
- Simplified admin catalog copy and replaced native DBF pickers with accessible Russian file-selection controls, selected filenames/sizes and pair count. Limits and parsing statistics remain expandable; import behavior is preserved.
- Verification: typecheck and 8 catalog DBF/import tests passed; Browser screenshots verified at 390x844 and 1440x1000 with a fake admin session and background jobs disabled. File selection states passed without horizontal overflow or JS errors. Compact spacing keeps the check action above mobile navigation at 390x844. Screenshots: .verification/catalog-ui/. Native iOS Safari and real DBF import were not exercised.

## Mobile account header — 2026-10-06
- Branch: local/mobile-user-name. Owner selected the second visual concept: brand above a dedicated account row linking to Settings.
- MobileHeader is integrated into Layout; blank names fall back to email, long identities truncate with complete accessible labels.
- Verification: fresh TypeScript and diff checks passed; isolated browser checks covered 320/390px overflow, 44px target, keyboard focus, and hiding at 768/1440px. Scoped visual QA passed; evidence remains local in .verification/design-account/.
- Full authenticated application runtime remains unverified. Owner authorized commit and push; production deployment is outside scope.
