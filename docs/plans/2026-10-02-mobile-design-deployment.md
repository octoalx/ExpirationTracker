# Mobile design deployment — 2026-10-02

## Authorized goal and acceptance
The owner explicitly requested deployment to the existing server for phone testing. Deploy the current reviewed working tree to expiry.axnode.xyz; preserve inventory, catalog, users and settings. Require fresh release checks, a Linux image build, isolated candidate startup/authentication checks, production health and row reconciliation. Keep existing Cloudflare Access.

## Revision and deployment approach
Identify the source by Git base and SHA-256 of a clean archive containing explicit current source files, lockfile and migrations. Do not include .env, local preview data, generated caches or verification logs. Build a separately tagged image while the current app remains running. Do not run deploy.sh: it pulls main and stops the entire stack. Recreate only app with the candidate image, then reload nginx.

## Recovery and risks
Create an online SQLite snapshot with restricted permissions; capture a read-only row digest and counts. Retain the current image under a rollback tag. Rehearse startup and migrations on a disposable snapshot with jobs disabled and fake integrations. For app failure, restore the previous image and recreate app; do not overwrite live data. Production startup retains existing notification and backup scheduling; do not change settings or trigger live sends. Physical camera/keyboard tests remain for the owner. JSON export is not a credential-preserving full backup; no recovery operations are part of deployment.

## Verification and result
- Fresh local release gate PASS: 23 application tests, three harness tests, typecheck and context checks; no skips.
- Source base c228be700db8cd321750c8fa395ce112bf411cff. Clean source archive SHA-256: 2248366200d8fd405f2f47cf48ea818d31f448a2beb846d4f8cbe992cb2f4059. Archive excludes local databases, environment files and verification artifacts.
- Server source is preserved; candidate context is releases/20261002-mobile-ui. Previous image retained as expirationtracker-rollback:pre-mobile-ui-20261002.
- Consistent online backup backups/pre-mobile-ui-20261002.db: integrity OK, 436 products, 106 catalog entries, one user and one settings record. Both notification transports disabled in current settings. Restricted snapshot permissions retained.
- Linux image built successfully on VPS as `expirationtracker-mobile:20261002` (config `sha256:cf2f67a7dfd84e2a67bfcfb41e26bd225d863e0124bde220ad19a60ffad4fb30`).
- Isolated rehearsal on production-copy SQLite passed all checks: login, session, 436 product records, statistics endpoint, admin users endpoint, all six page routes, and JS assets.
- Production app container recreated with candidate image; previous image retained as `expirationtracker-rollback:pre-mobile-ui-20261002`. Nginx reloaded without downtime.
- Live database row reconciliation: 436 products, 106 catalog entries, 1 user, 1 settings record; table SHA-256 digests and integrity check OK. Integrations remain disabled.
- Production HTTP checks: Nginx sign-in HTTP 200, unauthorized API endpoints HTTP 401, public domain https://expiry.axnode.xyz HTTP 302 (Cloudflare Access redirect), static assets (CSS, JS, fonts) HTTP 200.
- Physical phone camera, keyboard, vibration and safe areas remain to be tested by the owner on device.
- Follow-up verification on 2026-10-03 confirmed the candidate image is running and healthy; sign-in 200, private API 401, public Access redirect 302. All four live table digests still match the pre-deploy snapshot; integrity OK. No repeated deployment was necessary.
