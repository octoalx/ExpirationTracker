# Active context

Updated: 2026-10-14

## Where the project stands

Production is deployed by GitHub Actions and is healthy.

- **CD works end to end.** `.github/workflows/deploy-production.yml` runs only when
  started by hand (`workflow_dispatch`) and approved through the `production`
  environment. Merging a pull request never deploys. First successful run:
  `38513836556`, deploying `1cce2e7` in 8m15s.
- **The rollback path is no longer theoretical.** Run `38512003826` failed in the
  image build and the workflow automatically restored the previous revision; the
  site kept serving and no data was touched.
- **Production matches Git.** The host working tree has zero differences from the
  deployed revision, so `allow_dirty` is no longer needed for a normal deploy.
- **The 2026-10-13 sign-in failure is prevented, and the prevention is verified on
  the live host**: planting a corrupt `dev.db-journal` and restarting the app makes
  it quarantine the file and start in WAL. Details in
  `docs/plans/2026-10-14-sqlite-signin-incident.md`.

Facts worth not rediscovering:

- The production database runs in **WAL**. A non-WAL database lets one writer block
  every reader, which is what broke sign-in. The app asserts WAL on every startup.
- A deploy on this VPS takes **8-25 minutes** (2 cores, 1.9 GB RAM). A long build is
  normal, not a failure.
- The database is a single ~98 MB SQLite file. Every deploy takes a verified
  snapshot first, and the deploy refuses to continue without one.
- Node 22 is required for local checks (Node 26 breaks `better-sqlite3`): use
  `bash .verification/run-verify-release.sh`.

## Open threads

1. `.release-version` is written before the image build, so the marker can claim a
   new revision while the container still serves the old one. The check has been
   honest in practice but does not yet prove it.
2. Feature checks removed during the production sync are restored one feature at a
   time, never in bulk.
3. Browser UI and the native iOS date picker remain unverified.

## Operational context

VPS: `Alex@146.103.42.228:34657`, workspace `/home/Alex/ExpirationTracker`, public
`https://expiry.axnode.xyz` behind Cloudflare Access. The sole ADMIN is
`admin@localhost`. A dockerized Cloudflare tunnel routes to nginx on local port 8881.

## Invariants

Private APIs derive ownership from the verified session. Preserve barcode strings
and optional expiry/quantity. Camera requires an explicit start and HTTPS. Production
actions, migrations and backup restoration each require their own authorization.

Detailed history lives in `docs/plans/`, one dated file per task.
