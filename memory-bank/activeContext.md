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

## Mobile interface restored (2026-10-14)

`28719b8` (PR #7, a production-aligned sync) replaced the mobile-first lineage with an
older tree, so the dashboard rendered the desktop table at every width for eight days.
It was restored from `dc07476`, together with the assertions removed alongside it.
Details: `docs/plans/2026-10-14-restore-mobile-inventory.md`.
Local `better-sqlite3` is ABI 137 (Node 24): the suite runs under Node 24, not 22.

## Simple Excel import keeps final expiry dates (2026-10-20)

The Excel table dropped the expiry date for rows without a shelf life, because
`28719b8` made `expiryFromManufacture` return `null` there; in that format an empty
months cell means the date is already final. `inventory-import.ts` now carries
`finalExpiryDate`, and `parseCalendarDate` is shared for validation.
Details: `docs/plans/2026-10-20-simple-import-final-expiry.md`.

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

Hiring was only reachable at `/store` → «Команда», which the owner could not find.
Settings now carries a «Команда» tab, rendered by `StoreTeam` with
`variant="settings"`: hire, reset an employee password, revoke access, rename the
department and edit its thresholds, all from one screen.

- The tab appears only for an account with a membership (`MANAGER` sees the forms,
  `EMPLOYEE` a read-only list); a no-department account, the administrator
  included, does not see it and keeps personal thresholds.
- Thresholds are saved by `saveDepartmentThresholds()` (`requireManager`, and a
  support visit is refused) through `POST /api/store/settings`. The `/store` panel
  had been posting them to that route, which answered 403 — a real defect, now fixed.
- Department rename is `PUT /api/store/members` → `renameOwnDepartment()`.
- Verified on `origin/main` @ `f744cfa`: `typecheck`, `build`, `test:app` (102/102)
  and `check:context` all pass. An earlier red `typecheck`/`build` was only the
  branch being behind `main` — `75ec4e5` had already fixed the seed.

## Spec-driven execution with an approval gate (2026-10-23, merged PR #25)

A task that touches source, schema, scripts, tests or workflows starts as a spec in
`docs/specs/` and code exists only after the owner sets `Status: APPROVED` with a
filled `Owner approval` line. The loop, commit hygiene and the five merge questions
are in `docs/engineering/workflow.md`; the reasoning is ADR-0007.

- `npm run check:spec` (`scripts/check-spec.mjs`) runs in CI on every pull request
  and fails without an approved spec, without a verification entry per AC, or with a
  changed file the spec does not list and no `out-of-spec:` line explains it.
- `AGENTS.md` states the rule and a commit-hygiene section; the contract uses 1951 of
  its 2000 estimated tokens, so new rules belong in the workflow document.
- `check:context` enforces the 150-line cap on this file: archive detail in plans.
- ADR-0001…0007 record the decisions that used to live only inside dated plans.

## Excel import: no duplicates, and a broken row costs only itself (2026-10-23)

PR #27 stopped a repeated upload from doubling the table (same barcode + same expiry
date inside the department merges, `mergedQuantity`). PR #29 stopped a single broken
row from cancelling the file: `partitionInventoryProducts` validates row by row, the
endpoint answers 200 with `imported`/`skipped`/`rejected`/`errors`, and the dialog
previews a partly broken file, then shows imported / already present / rejected with
the reasons. Specs: `docs/specs/2026-10-23-import-{duplicates,partial-rows}.md`.

## Open threads

1. `.release-version` is written before the image build, so the marker can claim a
   new revision while the container still serves the old one. The check has been
   honest in practice but does not yet prove it.
2. Feature checks removed during the production sync are restored one feature at a
   time, never in bulk.
3. Browser UI and the native iOS date picker remain unverified.
4. The import dialog accepts a fixed four-column table; a fifth column makes the
   file unrecognized (`detectFileType` requires `range.e.c <= 3`).
5. Re-audit the process on 2026-11-06 against the metrics in
   `docs/engineering/workflow.md`.
6. `npm run dev` fails: the instrumentation hook resolves `./lib/prisma` through
   `runtimeRequire`, which works in the built app and not in the dev bundle. Use
   `npm run build && npm start`, and set `NEXTAUTH_SECRET` for `next start`.

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
