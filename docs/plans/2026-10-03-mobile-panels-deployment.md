# Mobile panels deployment — 2026-10-03

## Goal and acceptance
Deploy the owner's requested mobile add/scan fixes to the existing expiry.axnode.xyz service. Preserve users, inventory, catalog, settings, Cloudflare Access and scheduling. Require release checks, successful Linux build, isolated candidate authentication/API checks, production health and database reconciliation.

## Scope and revision
Reuse the deployed releases/20261002-mobile-ui source context and replace only src/pages/dashboard.tsx, src/components/AddProductForm.tsx and src/styles/globals.css. Source comparison confirms only the requested panel changes. Identify the candidate by a source manifest and image digest; no Git commit or push is requested. Fresh local verify:release passed 23 application tests, three harness tests, context and TypeScript with no skips.

## Recovery and risks
Create a restricted consistent SQLite snapshot and retain the running image as expirationtracker-rollback:pre-mobile-panels-20261003. Build while production runs. Rehearse the normal candidate entrypoint against disposable snapshot storage with background jobs disabled and fake credentials/integrations. Recreate only app, then reload nginx. If health fails, retag the preserved image and recreate app without overwriting live data. Do not run deploy.sh, restore production data, import inventory or trigger live notifications. Real-device keyboard and camera remain manual checks.

## Result
- Linux build PASS. Deployed image: `sha256:e0f81931ea845297a50e8d804e91a2443932a3bd5a9cff09bdde8408b347ad88`, tag `expirationtracker-mobile-panels:20261003`.
- Candidate source manifest: `releases/20261003-mobile-panels/mobile-panels-source.sha256`; all three hashes match local source. Only these files differ from the previous release context.
- Restricted consistent snapshot: `backups/pre-mobile-panels-20261003.db`; integrity OK. Rollback tag retained as planned.
- Isolated normal-entrypoint rehearsal PASS: authentication, ownership boundary, 436 records, statistics, admin, six routes and JavaScript assets. Background jobs disabled; fixture integrations and credentials replaced; container stopped after verification.
- Production app healthy; sign-in HTTP 200, anonymous products/catalog APIs HTTP 401; public HTTPS HTTP 302 to existing Cloudflare Access. Nginx configuration and reload PASS.
- Served CSS and dashboard JavaScript contain the new panel selectors and responsive focus handling; asset requests HTTP 200.
- Complete SHA-256 row digests for User, Product, CatalogEntry and Settings match the pre-deploy snapshot. Counts: 1 user, 436 products, 106 catalog entries, 1 settings record. Integrity OK; both notification transports remain disabled.
- No commit, push, inventory import or production data restoration. Physical-phone camera, keyboard and safe areas remain owner checks.
