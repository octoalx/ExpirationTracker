# Mobile deletion and pagination deployment — 2026-10-03

## Goal and acceptance
Deploy commit 425e0e0 mobile UI files to the existing expiry.axnode.xyz application.
Use verified target Alex@146.103.42.228:34657 and /home/Alex/ExpirationTracker.
Never use the stale 91.108.249.220 SSH configuration for this project.
Preserve the currently deployed DBF catalog source, all data and scheduling.

## Approach and recovery
Copy the preserved DBF release source into a new release directory and overlay
only the three committed UI files. Record archive hashes. Build while production
runs. Keep the current image under a rollback tag and take an online SQLite backup.
Rehearse normal startup on disposable sanitized storage with background jobs disabled.
Switch only app, reload nginx, check HTTP/private API denial and table fingerprints.
On failure restore the previous image and recreate app; never overwrite live data.

## Verification
Fresh release gate passed: 49 application tests, 3 harness tests, typecheck/context.
Require Linux build, isolated startup/HTTP and production health/data reconciliation.
Real-phone layout remains manual. No push is requested.

## Result
Deployment complete. UI source commit 425e0e0; overlay archive SHA-256
470d6d854fd9a75c5194a3a261a80d9ccc70d204d801bf13b62f3aee7ab59678.
Built from preserved DBF release source plus exactly the three committed UI files.
Image expirationtracker-mobile:425e0e0, deployed image ID
sha256:060a0334c43aa2eb84107db988be70872796dabdf17e7982b47027012e0630ca.
Linux production build passed. Sanitized isolated normal-entrypoint rehearsal
passed login/session, inventory/stats, dashboard/settings and 11 JS/CSS assets;
anonymous inventory rejected. Six table fingerprints matched before/after rehearsal.
Live database locked external readers while the old process ran. Took a verified
online snapshot, then stopped only app for a final consistent snapshot/fingerprints
before replacement. Final restricted backup: backups/pre-mobile-425e0e0-final.db.
Live before/after six table fingerprints identical: User 4, Product 463,
CatalogEntry 106, Settings 3, Account 0, SharedCatalogEntry 444297; integrity OK.
App healthy; nginx config/reload passed; sign-in 200, nine assets 200, anonymous
products/catalog/thresholds 401; public HTTPS retains Cloudflare Access redirect 302.
Rollback retained as expirationtracker-rollback:pre-mobile-425e0e0. Evidence under
/home/Alex/.codex-releases/expirationtracker-mobile-425e0e0. No push, source reset,
manual live sends or data restoration. Phone gesture/layout verification remains manual.
