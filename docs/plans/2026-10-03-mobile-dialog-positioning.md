# Production dialog positioning repair — 2026-10-03

## Goal and acceptance
Repair mobile dialogs that show only their lower-right corner in iOS Brave/Chrome. Verify optimized production CSS and actual candidate UI; normal dashboard refresh must keep dialogs closed, and edit links from statistics must open once without reopening on refresh. Preserve inventory and existing deployment configuration.

## Confirmed cause and change
The published CSS minifier merged `transform: none; translate: none` into `transform: translate(0)` and removed the individual translate reset. Tailwind's separate translate utility therefore continued shifting the full-screen dialog by -50%. Development CSS had preserved the reset, so dev-browser verification missed the defect.
Move centering into one conventional transform in `.dialog-surface` and remove dialog enter/exit animations: generated animation transforms also conflict with conventional centering, and breakpoint changes during exit can strand closed content. Consume the `edit` query after opening an existing product; statistics intentionally provides this query, but it previously remained across reloads. Key page transitions by pathname so shallow query cleanup preserves the open editor instead of remounting the page.

## Verification and deployment
Add a regression that compiles the actual stylesheet through Tailwind and Next's production CSS optimizer. Run it plus fresh release checks. Build from the currently deployed release context with only dialog.tsx, dashboard.tsx, _app.tsx and globals.css replaced. A release-local Dockerfile copies the previous builder's Next cache to accelerate the final build; application source and dependency versions remain unchanged. Rehearse against isolated SQLite storage with jobs and integrations disabled, including browser inspection of the optimized app. Create a fresh consistent production snapshot and preserve the current image for rollback. Recreate only app, reload nginx, verify HTTP/assets and reconcile all table digests. Do not restore production data or send notifications.

## Risks and recovery
Shared dialog centering affects desktop/import/edit dialogs; inspect desktop positioning too. Actual iOS camera/keyboard checks remain with the owner. Rollback restores the prior image without overwriting the database. No Git push or unrelated source changes.

## Result
- PASS: fresh release checks (23 application tests, three harness tests, context and TypeScript), optimized stylesheet regression and diff review. No skips.
- Final image `expirationtracker-dialog-positioning:20261003-final`, digest `sha256:a67c132dd4a656d6c878ed9dbb4ef456c013ac69713804bb6a85f17e1965b5c7` deployed. Manifest: `releases/20261003-dialog-positioning/dialog-positioning-source.sha256`.
- Isolated normal-entrypoint rehearsal PASS: authentication, ownership rejection, 436 products, statistics, admin, six page routes and JavaScript asset. Jobs disabled and fixture integrations cleared.
- Actual optimized app browser PASS: add and scan panels cover 320×640 and 390×844 viewports without overflow; desktop panel at 1280×800 is centered; closing unmounts content. Statistics edit link opens the editor and clears the query without remounting; refreshing that page returns with zero dialogs.
- SSH port forwarding is prohibited by the server. Browser verification used a temporary localhost-only HTTP relay through SSH to the isolated container; no production access protections changed. Isolated container stopped and local relay removed from service after checking.
- Production healthy; sign-in 200, anonymous products/catalog 401, public HTTPS 302 to unchanged Cloudflare Access; nginx configuration/reload PASS. Served CSS and dashboard JS checked for the fix, assets 200.
- Snapshot `backups/pre-dialog-positioning-20261003.db` integrity OK; rollback `expirationtracker-rollback:pre-dialog-positioning-20261003` retained. All table IDs preserved: 436 products, 106 catalog entries, 1 user/settings. User/catalog/settings rows unchanged; all product business fields unchanged. One product's updatedAt differs from the snapshot taken before the long build; full-row digest equality is therefore not claimed.
- No production restoration, inventory import, Git commit or push. Actual iOS device verification remains with the owner.
