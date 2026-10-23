# Active context

Updated: 2026-10-23

## Where the project stands

Production is deployed by GitHub Actions and is healthy.

- **CD works end to end.** `.github/workflows/deploy-production.yml` runs only when
  started by hand (`workflow_dispatch`) and approved through the `production`
  environment. Merging a pull request never deploys. First successful run:
  `38513836556`, deploying `1cce2e7` in 8m15s.
- **The rollback path is no longer theoretical.** Run `38512003826` failed in the
  image build and the workflow automatically restored the previous revision; the
  site kept serving and no data was touched.
- **Production matches Git**: the host tree has zero differences from the deployed revision.
  deployed revision, so `allow_dirty` is no longer needed for a normal deploy.
- **The 2026-10-13 sign-in failure is prevented, and the prevention is verified on
  the live host**: planting a corrupt `dev.db-journal` and restarting the app makes
  it quarantine the file and start in WAL. Details in
  `docs/plans/2026-10-14-sqlite-signin-incident.md`.

Facts worth not rediscovering:

- The production database runs in **WAL**. A non-WAL database lets one writer block
  every reader, which is what broke sign-in. The app asserts WAL on every startup.
- A deploy takes 8-25 minutes (2 cores, 1.9 GB RAM); a long build is normal. Every
  deploy takes a verified SQLite snapshot first and refuses to continue without one.
- Node 22 is required for local checks (Node 26 breaks `better-sqlite3`): use
  `bash .verification/run-verify-release.sh`.

## Mobile restored, simple expiry fixed (2026-10-14, 2026-10-20)

`28719b8` replaced the mobile-first lineage with an older tree (desktop table at every
width for eight days); `dc07476` restored it with its assertions — see
`docs/plans/2026-10-14-restore-mobile-inventory.md`. That sync also made the simple
Excel table drop final expiry dates; `finalExpiryDate` in `inventory-import.ts` fixed
it — see `docs/plans/2026-10-20-simple-import-final-expiry.md`. Local
`better-sqlite3` is ABI 137: the suite runs under Node 24, not 22.

## Department access model implemented (2026-10-21, branch `local/department-access-model`)

The service is one store with departments. A department (`Store`) is the only
product scope, it has exactly one manager and any number of employees, and no
account — the platform administrator included — reads a table it does not belong
to.

- `inventoryScope()` requires a `StoreMembership` and refuses everything else with
  403; the personal (`storeId = null`) branch is gone. `storeMembership()` is the
  non-throwing lookup for background jobs and "no department" screens.
- Self-registration founds a department and its manager in one transaction;
  managers hire employees with credentials and reset their passwords; the
  administrator runs the department registry, ownership transfer, deletion and a
  logged temporary support visit.
- The old personal-to-store transfer flow is removed. `Store.id` is a cuid with a
  `createdAt` (migration `20261021000000_department_access_model`).
- `Product.storeId` is `NOT NULL` in the repository (migration
  `20261022000000_product_store_required`). That migration may only be deployed
  **after** the owner-approved purge: it refuses a row without a department, and
  the deploy applies migrations at startup.
- The production purge ran on 2026-10-21 with the owner's explicit approval:
  `scripts/purge-departments.mjs` kept `admin@localhost` and the shared barcode
  catalog (444 297 rows) and removed every other account, department, membership,
  product and queue row. It wrote a verified pre-purge snapshot to `/app/backups`
  first and recorded the filename in a `SystemLog` row, so rollback is a restore of
  that file rather than a reverse script. Owner decisions and the verification list
  are in `docs/plans/2026-10-21-brief-department-purge.md`.

## Settings gained a team tab (2026-10-21, branch `local/settings-team-tab`)

Hiring was only reachable at `/store` → «Команда». Settings now carries a «Команда»
tab (`StoreTeam`, `variant="settings"`): hire, reset a password, revoke access,
rename the department and edit thresholds from one screen.

- The tab appears only for an account with a membership (`MANAGER` sees the forms,
  `EMPLOYEE` a read-only list); a no-department account, the administrator
  included, does not see it and keeps personal thresholds.
- Thresholds are saved by `saveDepartmentThresholds()` (`requireManager`, and a
  support visit is refused) through `POST /api/store/settings`. The `/store` panel
  had been posting them to that route, which answered 403 — a real defect, now fixed.
- Department rename is `PUT /api/store/members` → `renameOwnDepartment()`.
- Verified on `origin/main` @ `f744cfa`: `typecheck`, `build`, `test:app` (102/102)
  and `check:context` pass. An earlier red `typecheck`/`build` was only the branch
  being behind `main` — `75ec4e5` had already fixed the seed.

## Spec-driven execution with an approval gate (2026-10-23, merged PR #25)

A task that touches source, schema, scripts, tests or workflows starts as a spec in
`docs/specs/`; code exists only after the owner sets `Status: APPROVED` with a filled
`Owner approval`. The loop, commit hygiene and the five merge questions are in
`docs/engineering/workflow.md`; the reasoning is ADR-0007.

- `npm run check:spec` (`scripts/check-spec.mjs`) runs in CI on every pull request
  and fails without an approved spec, without a verification entry per AC, or with a
  changed file the spec does not list and no `out-of-spec:` line explains it.
- `AGENTS.md` states the rule and a commit-hygiene section; the contract uses 1951 of
  its 2000 estimated tokens, so new rules belong in the workflow document.
- `check:context` enforces the 150-line cap on this file: archive detail in plans.
- ADR-0001…0007 record the decisions that used to live only inside dated plans.

## Excel import: no duplicates, and a broken row costs only itself (2026-10-23)

PR #27 stopped a repeated upload from doubling the table (same barcode + expiry date
in the department merges, `mergedQuantity`). PR #29 stopped a broken row from
cancelling the file: `partitionInventoryProducts` validates row by row, the endpoint
answers 200 with `imported`/`skipped`/`rejected`/`errors`, and the dialog previews a
partly broken file and then shows the three numbers. Specs:
`docs/specs/2026-10-23-import-{duplicates,partial-rows}.md`.

## Release proof and the fifth column (2026-10-23, merged PR #31, #32)

The revision is baked into the image (`ARG BUILD_REVISION`) and reported by
`GET /api/version`; the health check asks the running container instead of reading the
marker the workflow wrote itself, and the host marker is written only after
`docker compose up -d`. A fifth column no longer hides the simple table:
`detectFileType` decides from three header cells. `npm run dev` starts again (PR #34):
the hook builds its two guard modules for development; production keeps the unchanged
`runtimeRequire` branch. Specs: `docs/specs/2026-10-23-{release-version-truth,import-fifth-column,dev-server-startup}.md`.
The first deploy of this workflow needs the previous one to ship the commit once,
because the running release has no `/api/version` yet.

## Task continuity (2026-10-23)

One task = one session; state comes from this file, `git log` and open PRs, never a
chat. Closing a task updates this file and the plan's `Status:`/`Evidence:`
(`scripts/check-plan-status.sh`). Spec: `docs/specs/2026-10-23-task-continuity.md`.

## Open threads

1. Feature checks removed during the production sync are restored one at a time,
   never in bulk.
2. Browser UI and the native iOS date picker remain unverified.
3. Re-audit the process on 2026-11-06 against the metrics in
   `docs/engineering/workflow.md`.

## Operational context

VPS: `Alex@146.103.42.228:34657`, workspace `/home/Alex/ExpirationTracker`, public
`https://expiry.axnode.xyz` behind Cloudflare Access. The sole ADMIN is
`admin@localhost`. A dockerized Cloudflare tunnel routes to nginx on local port 8881.

## Invariants

Private APIs derive identity from the verified session and scope product access by
the caller's department membership; there is no personal product scope. Preserve
barcode strings and optional expiry/quantity. Camera requires an explicit start and
HTTPS. Production actions, migrations and backup restoration each require their own
authorization.

Detailed history lives in `docs/plans/`, one dated file per task.
