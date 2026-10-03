# Active context

Updated: 2026-10-03

## Current milestone

Production mobile-dialog positioning repaired and deployed on 2026-10-03 after iOS Brave/Chrome still showed only the lower-right corner. Confirmed Next CSS optimization removed the individual translate reset while Tailwind kept -50% translation. Centering now uses one conventional transform; dialog animations removed. Edit query is consumed and page transitions key by pathname. Final image `expirationtracker-dialog-positioning:20261003-final` (`sha256:a67c132dd4a656d6c878ed9dbb4ef456c013ac69713804bb6a85f17e1965b5c7`). Release checks, optimized-CSS regression, isolated API rehearsal and actual optimized UI at 320/390/1280px PASS, including edit-link/reload and close unmount. Production healthy; all business data preserved (one updatedAt changed since snapshot). Recovery: `backups/pre-dialog-positioning-20261003.db`, `expirationtracker-rollback:pre-dialog-positioning-20261003`. Actual iOS owner verification pending. Details: `docs/plans/2026-10-03-mobile-dialog-positioning.md`.

Mobile add/scan panel fixes deployed on 2026-10-03 to the existing service. Image `expirationtracker-mobile-panels:20261003` (`sha256:e0f81931ea845297a50e8d804e91a2443932a3bd5a9cff09bdde8408b347ad88`); only three UI files replaced over the previous release context. Fresh release gate, Linux build, isolated authentication/API rehearsal, served assets and production health PASS. Full table digests unchanged (436 products, 106 catalog entries, 1 user, 1 settings). Snapshot `backups/pre-mobile-panels-20261003.db`, rollback `expirationtracker-rollback:pre-mobile-panels-20261003`. Physical phone checks remain manual. Details: `docs/plans/2026-10-03-mobile-panels-deployment.md`.

Mobile UX redesign deployed to https://expiry.axnode.xyz on 2026-10-02 at the owner's request.
- Follow-up on 2026-10-03: deployed candidate healthy; HTTP checks and all four table digests reconfirmed. No repeat deployment needed.
- Candidate image `expirationtracker-mobile:20261002` built on VPS and verified with isolated rehearsal against production-copy SQLite (login, 436 products, statistics, admin, all routes, static JS/CSS).
- Production app container recreated without downtime; nginx reloaded; previous image retained as `expirationtracker-rollback:pre-mobile-ui-20261002`.
- Pre-deploy consistent backup: `backups/pre-mobile-ui-20261002.db` (integrity OK, restricted permissions).
- Post-deploy live row reconciliation: 436 products, 106 catalog entries, 1 user, 1 settings record; table digests and integrity check OK. Integrations remain disabled.
- Production HTTP checks: Nginx sign-in HTTP 200, unauthorized API endpoints HTTP 401, public domain https://expiry.axnode.xyz HTTP 302 (Cloudflare Access redirect), static assets (CSS, JS, fonts) HTTP 200.
- Physical phone camera, keyboard, vibration and safe areas remain to be verified by the owner on device. Plan: `docs/plans/2026-10-02-mobile-design-deployment.md`.

## Prior milestones


Full working inventory replaced from the newly attached SROKI.csv on 2026-10-02, as explicitly requested. The new full-table request supersedes the earlier partial replacement.
- Removed all 275 prior owner products; imported every one of the 436 new source records without deduplication.
- 267 manufacture dates plus months; 169 direct expiry dates; zero missing dates. No OLD markers. One source barcode is empty and remains empty.
- All 106 catalog entries, owner and settings preserved. Online backup, disposable rehearsal, independent source/date reconciliation and integrity PASS.
- Seven date/UI regression tests PASS in normal timezone and America/New_York. Service healthy, sign-in HTTP 200. No app deployment or schema change.
- Recovery: backups/pre-new-csv-replacement-20261002.db and backups/new-csv-replacement-20261002.json. See docs/plans/2026-10-02-replace-from-new-csv.md.
## Earlier deployment evidence (source date counts superseded)

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

## Source date investigation (2026-10-02)
Read-only recheck of the original SROKI.txt: 429 rows, 157 OLD excluded, all 272 included rows contain a source date; 103 have no shelf-life months. parseLegacyInventory treats every source date as manufacture date and returns null expiry when months are blank. Examples include source dates in 2027. Six inventory regression tests pass. No application or production data changes. Owner subsequently confirmed blank-month rows contain final expiry dates; replacement completed as recorded above.

## Mobile UX discovery (2026-10-02)
- Confirmed users: owner and store colleagues; phones primary, desktop retained.
- Primary flow: barcode scan, existing-record lookup, quick registration with expiry or manufacture date plus shelf life.
- Product facts saved in PRODUCT.md. Independent source-based UX review requested; visual/runtime review remains pending.
- Confirmed: account-scoped inventory; known barcode shows matching records, absent barcode opens registration. No dedicated new-batch flow.
- Visual concepts are being prepared before implementation; plan: docs/plans/2026-10-02-mobile-ux-redesign.md. Existing owner-scoped APIs remain unchanged.
- Owner selected the merged light graphite/blue concept. Implemented shell, mobile records, exact barcode scan routing, registration/date preview, local font and restrained feedback; desktop table preserved.
- PASS: typecheck, 20 app tests, 3 harness tests, context checks; exact scan/date tests in three timezones. Isolated browser verified lookup, catalog prefill and save; 360/390/430 and desktop inspected. Independent source/visual review addressed.
- Preview: localhost:3107, disposable .verification/mobile-ux/preview.db, background jobs disabled. No production deployment. Real camera/vibration/phone keyboard remain unverified; isolated migration-engine failure and preview workaround recorded in the plan.
- Preview recovery: the original dev process had stopped. Restarted a hidden standalone PowerShell process using ignored .verification/mobile-ux/start-preview.ps1; /auth/signin returned HTTP 200. Browser reload of an error-page tab was policy-blocked; owner must refresh that tab manually. Restart uses a fresh session secret, so preview login may be needed again.
- Mobile reference refinement: barcode now uses ScanBarcode corner frame; status dots increased from 6 to 10 px, status text from 12 to 14 px, spacing adjusted. Typecheck and seven inventory tests pass; this refinement has not yet been visually verified in the browser.
- Mobile row refinement: 12 px horizontal padding, shared highlighted surface for expanded/selected records, explicit icon badges for ACTIVE/ARCHIVED/DEFECT. Typecheck and seven inventory tests pass; live accessibility tree shows all statuses, but browser input failed so expanded-state visual verification remains pending.

- App visual system refinement: weight-800 branding/headings, warm amber expiry tokens, blue controls across auth/settings/import/admin/analytics, opaque white panels and visible mobile settings tab labels. Typecheck and 20 app tests pass; six page routes return HTTP 200. Mobile header screenshot inspected; browser input timeout prevents full page-by-page visual verification. Existing stats API null-expiry failure remains outside these visual changes. Plan: docs/plans/2026-10-02-app-visual-system.md.
- Import entry refinement: replaced remaining dashboard emerald controls with blue, retained collapsed bulk import and clarified its purpose in the add-product dialog. Typecheck passes; visual interaction remains unverified.

## Operational statistics and administration (2026-10-02)
- Statistics now prioritize active expiry risks, missing dates and direct edit links; archive/defect are separate inventory counts. Fixed the prior null-expiry API failure; calendar boundaries and zero thresholds are covered.
- Mobile admin uses user cards, visible tab labels, expandable technical log details and wrapping backup controls. Server role checks and mutation behavior preserved.
- Fresh typecheck PASS, 22 application tests PASS without skips, context and diff checks PASS. Statistics tests PASS in Minsk and Los Angeles timezones. Isolated browser verified risk fixtures, missing-date edit navigation, all admin sections on phones and desktop users. Plan: docs/plans/2026-10-02-operational-stats-admin.md.
- Local preview only; disposable admin fixture admin-ux@example.invalid uses the existing isolated preview password. No production actions or admin mutations. Physical phone testing remains pending.
- Header cleanup: removed duplicate mobile settings shortcut; statistics refresh is a labelled secondary action at page bottom. Typecheck and scoped diff checks PASS; 473 px browser inspection confirms both changes.

## Final local verification (2026-10-02)
- Rechecked auth, mobile expanded/selected records, add/import entry, settings integrations and desktop Excel modal. Fixed clipping of settings tabs and associated input/switch labels.
- Disposable SQLite admin test verifies roles, password reset, authorization, JSON restore null dates and atomic rollback; actual file-recovery handler preserves credentials and emergency snapshot with connections closed. JSON exports omit passwords; clarified UI. Concurrent/WAL recovery remains unverified.
- Release gate PASS: 23 app tests, three harness tests, typecheck, context. Build PASS; added optional NEXT_DIST_DIR after fixing a dev/build cache collision. Preview recovered with authenticated products HTTP 200, jobs disabled.
- Direct plugin Stop/PostToolUse commands exit 0; real app hook scheduling is not verified. Additional production-mode startup was auto-review blocked, so running optimized-build verification is incomplete. No deployment/commit/push.
- Physical phone camera, keyboard, vibration and safe areas require an HTTPS preview of this revision and owner testing. Detailed evidence and limitations: docs/plans/2026-10-02-final-ux-verification.md.

## Mobile add/scan panels (2026-10-03)
- Scoped product-dialog styling keeps the header and close control visible during scrolling, respects safe areas, constrains grid/fieldset width, and stacks shelf-life controls below 375px.
- Mobile opening no longer focuses an input automatically; desktop input focus is preserved.
- Acceptance: add/scan panels fit narrow screens, remain scrollable, and keep closing accessible. Isolated preview checked at 320/390/1280px with no horizontal panel overflow. Physical keyboard, safe areas and camera decoding remain unverified (preview camera not found).
- PASS: TypeScript, four mobile-product-flow tests, design detector (no findings). No deployment.
