# Production dialog positioning repair — 2026-10-03

## Goal and acceptance
Repair mobile dialogs that show only their lower-right corner in iOS Brave/Chrome. Verify optimized production CSS and actual candidate UI; normal dashboard refresh must keep dialogs closed, and edit links from statistics must open once without reopening on refresh. Preserve inventory and existing deployment configuration.

## Confirmed cause and change
The published CSS minifier merged `transform: none; translate: none` into `transform: translate(0)` and removed the individual translate reset. Tailwind's separate translate utility therefore continued shifting the full-screen dialog by -50%. Development CSS had preserved the reset, so dev-browser verification missed the defect.
Move centering into one conventional transform in `.dialog-surface`, remove individual translate/zoom utilities from DialogContent, and disable mobile dialog transform animations. Consume the `edit` query after opening an existing product; statistics intentionally provides this query, but it previously remained across reloads.

## Verification and deployment
Add a regression that compiles the actual stylesheet through Tailwind and Next's production CSS optimizer. Run it plus fresh release checks. Build from the currently deployed release context with only dialog.tsx, dashboard.tsx and globals.css replaced. Rehearse against isolated SQLite storage with jobs and integrations disabled, including browser inspection of the optimized app. Create a fresh consistent production snapshot and preserve the current image for rollback. Recreate only app, reload nginx, verify HTTP/assets and reconcile all table digests. Do not restore production data or send notifications.

## Risks and recovery
Shared dialog centering affects desktop/import/edit dialogs; inspect desktop positioning too. Actual iOS camera/keyboard checks remain with the owner. Rollback restores the prior image without overwriting the database. No Git push or unrelated source changes.

## Result
Pending production build, browser rehearsal and deployment.
