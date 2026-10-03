# Active context

## Latest production release — admin and settings, 2026-10-03
- Owner authorized committing and deploying all current changes. Source commit
  4e3cf91 is deployed from releases/20261003-admin-settings on the same confirmed
  Alex@146.103.42.228:34657 target; server checkout preserved, no push.
- Deployed expirationtracker-admin-settings:20261003, image ID
  sha256:c64219e2c0a296710244025fcb2d834c6ba6f54cc17265627247a751527c0ed3.
- Includes empty threshold input handling, mobile days below urgency, integration
  alignment and admin account creation. Existing mobile/date/scanner changes included.
- Release gate PASS (38 application tests, 3 harness, typecheck/context); Linux build,
  isolated admin/employee login and creation, critical flows and preservation PASS.
  Production healthy, background jobs started, 11 assets HTTP 200, Access HTTP 302.
- Both users, 434 products, 106 catalog entries and settings preserved exactly.
  Backups pre-admin-settings-20261003.db and pre-admin-settings-switch-20261003.db
  are restricted and intact; rollback expirationtracker-rollback:pre-admin-settings-20261003.
- Evidence/recovery: docs/plans/2026-10-03-admin-settings-deployment.md.
  Actual phone/browser visual checks remain unperformed.

## Production deployment — 2026-10-03
- Confirmed target: Alex@146.103.42.228, SSH port 34657; workspace
  /home/Alex/ExpirationTracker; site https://expiry.axnode.xyz behind Cloudflare Access.
  Do not use the unrelated 91.108.249.220 entry in local SSH config.
- Owner authorized deployment of mobile edit, expiry thresholds and scanner changes.
  Successfully deployed expirationtracker-mobile-features:20261003, config
  sha256:1a13c3b71e8052a06d82d75b3c98e5474a0751cf96565d6dc5a0f7962c1f7471.
- Edit dialog has no automatic input focus and uses mobile width/overflow constraints.
  Add/edit forms preserve manufacture date, duration and unit; server recalculates
  expiry. Migration 20261003000000_product_manufacture_date is applied in production.
  Legacy manufacture dates cannot be recovered automatically; nullable expiry remains.
- Fixed nested settings consumption. Saved thresholds refresh through save/tab/focus
  events and every 30 seconds while visible; calendar changes refresh memoized columns.
  Desktop/mobile urgency labels: urgent red, warning orange. Counts match active filters.
  Existing production settings are preserved: urgent 3, warning 100.
- Scanner preview starts concurrently with decoder loading; rear 1280x720 preference,
  optional continuous focus, 150ms retries and cancellation-safe stream cleanup.
- Verification: release gate PASS (37 app tests, 3 harness, typecheck/context), local
  production build, cached Linux build and isolated normal-entrypoint rehearsal PASS.
  Snapshot rehearsal covered migration preservation, login, thresholds=30, manufacture
  editing, optional expiry, stats/admin/pages/assets with integrations/jobs disabled.
- Production app healthy; sign-in 200; private APIs 401; nine JS/CSS assets 200;
  public HTTPS 302 to unchanged Access. Exact original-column fingerprints preserved:
  434 products, 106 catalog records, one user/settings, zero accounts; integrity OK.
- Backups: backups/pre-mobile-features-20261003.db and
  backups/pre-mobile-features-switch-20261003.db, consistent and restricted.
  Rollback image: expirationtracker-rollback:pre-mobile-features-20261003.
- Release source archive SHA-256:
  d6b7ed51db7b3b919153a36ddd2432a5d8df2f78669bfd1c16bbb80fd6a87db7;
  base 15f9338; server context releases/20261003-mobile-features. No commit/push.
- Phone recognition speed, keyboard and safe-area behavior remain owner device checks.
  Evidence/recovery: docs/plans/2026-10-03-mobile-edit-thresholds-deployment.md.

### Settings input and layout refinement (2026-10-03)
- Threshold inputs retain an empty value while editing; blur/save normalizes it to zero.
- Mobile inventory places remaining days below urgency labels. Expanded integrations have consistent padding; SMTP grids align controls and stack notification times on phones.
- Verification: typecheck PASS; threshold/render tests 6 PASS, 0 SKIP; diff check and UI detector PASS. Browser interaction and visual verification remain unperformed.

### Admin account creation (2026-10-03)
- Admin > Users now has an inline creation form: name, email, password and USER/ADMIN role (default USER). POST /api/admin/users verifies admin session, validates fields, hashes passwords and returns public fields only; duplicate emails return 409.
- Disposable SQLite tests cover authorization, validation, both roles, duplicate races, actual credentials login and existing inventory preservation. Focused admin tests 2 PASS; typecheck/context/harness/diff/UI detector PASS. Browser verification remains unperformed; no deployment.
- Plan: docs/plans/2026-10-03-admin-account-creation.md.
