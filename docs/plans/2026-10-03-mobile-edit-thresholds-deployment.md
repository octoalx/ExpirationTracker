# Mobile editing, thresholds and scanner deployment — 2026-10-03

## Authorized goal
Deploy the reviewed working tree to the existing production server for owner phone
testing. Preserve production users, integrations, inventory and catalog. Do not
commit or push merely to deploy: use the prior archive/image release workflow.

## Confirmed target
SSH: `Alex@146.103.42.228`, port `34657`. Workspace:
`/home/Alex/ExpirationTracker`. Public domain: `expiry.axnode.xyz` behind existing
Cloudflare Access. Confirmed from actual successful deployment command history.
Do not use `91.108.249.220:54783` from the unrelated local SSH configuration.

## Source and acceptance
Base: `15f9338`; include explicit current application changes, lockfile, tests and
the nullable manufacture metadata migration. Identify the archive by SHA-256.
Require release checks, successful image build, isolated candidate migration and
startup, production HTTP/asset checks and database preservation reconciliation.

## Procedure and recovery
Inspect the existing server release configuration first. Keep production running
while building a separately tagged candidate. Create a consistent restricted online
SQLite backup; test migration and restoration on a disposable copy with background
jobs disabled and integrations cleared. Retain the existing image for rollback.
Recreate only app and reload nginx. If startup fails, recreate with the old image;
the additive nullable migration is compatible with the old app. Never overwrite
the live database. Do not use deploy.sh because it pulls main and stops the stack.

## Current evidence
- Fresh `npm run verify:release`: PASS for context, harness (3), TypeScript and
  application tests (37); zero skipped.
- Saved SSH target `Alex@91.108.249.220:54783` refuses connection with both installed
  OpenSSH clients. Public HTTPS still redirects to Cloudflare Access; that does
  not confirm application health behind Access.
- Asked the owner to restore SSH access or provide the updated target. No remote
  writes, container replacement or production migration have been performed.
- `npm run build`: PASS with background jobs disabled, disposable database URL
  and generated test session secret. No production integrations were loaded.
- Reviewed source base: `15f9338bd67993e2408c307bdbb99433f6720dc5`.
  Prepared 190-file source archive in ignored local verification storage:
  `.verification/release-20261003-mobile-features/candidate-source.tar`.
  SHA-256: `d6b7ed51db7b3b919153a36ddd2432a5d8df2f78669bfd1c16bbb80fd6a87db7`.
  Archive excludes environment files, databases, backups and generated artifacts;
  a per-file SHA-256 manifest is stored alongside it. The archive is immutable;
  subsequent deployment evidence updates are outside that snapshot.
- Deployment remains pending SSH access. Linux build, representative production
  snapshot rehearsal and live health checks remain unexecuted.

Owner confirmed SSH username `Alex` (capital A). Retried explicit `Alex` with both Windows and Git OpenSSH clients; connection is still refused before SSH authentication. Production remains unchanged.

## Corrected deployment target
Previous successful deployment command history confirms `Alex@146.103.42.228:34657`, workspace `/home/Alex/ExpirationTracker`. SSH connection succeeded on 2026-10-03. The address `91.108.249.220:54783` belongs to a stale local SSH configuration and must not be used for this project. Production sign-in returns 200; app is healthy. Continue the authorized backup, isolated rehearsal and app-only deployment.

## Server preparation and build
- Source archive uploaded and all 190 per-file hashes verified.
- Current image retained as `expirationtracker-rollback:pre-mobile-features-20261003`
  (config `sha256:f87c1a3057f57c650b199571597061d322c66c5089e990910f3a1a4f01da12df`).
- Consistent restricted snapshot `backups/pre-mobile-features-20261003.db`:
  integrity OK, 434 products, 106 catalog entries, one user/settings; both
  notification transports disabled. No production settings changed.
- Initial full Docker build intentionally cancelled during redundant parallel
  npm installations because the 936MB server was swapping heavily. It is not
  reported as a passed build.
- Retained builder and candidate lockfiles match SHA-256
  `00315b5a993d59cbfbda9e3ab0209d8eb098da29addb4f64c4286816781ac2b0`.
  Build uses the retained builder for identical dependencies and the retained
  runtime image, regenerates Prisma and builds all current source. Application
  source and package versions are unchanged by this optimization.
- Release-only `Dockerfile.cached` SHA-256:
  `441e637a443ada476d65e1cf2f05b783a5925dee921c78b65ce650cd2370d74a`.
  Retained builder config:
  `sha256:3613d3d3fe695c86104749452f726b3797e70e9c5b783c55c398216f5d4d5055`.

## Deployment result
- Cached Linux build PASS. Deployed image `expirationtracker-mobile-features:20261003`,
  config `sha256:1a13c3b71e8052a06d82d75b3c98e5474a0751cf96565d6dc5a0f7962c1f7471`.
- Isolated production-snapshot restoration and migration PASS: all original columns
  and rows in User, Product, CatalogEntry, Settings and Account match the snapshot;
  new manufacture metadata is null. Database integrity OK.
- Normal-entrypoint rehearsal with background jobs and integrations disabled PASS:
  authenticated login, 434 records, save/read thresholds=30, invalid-threshold
  rejection, manufacture create/edit/recalculation, optional expiry clearing,
  delete fixture, statistics, admin routes, six pages and assets.
- Fresh restricted snapshot `backups/pre-mobile-features-switch-20261003.db` made
  immediately before app-only replacement. Nginx config/reload PASS; other services
  were not recreated. Prior image retained for rollback without data restoration.
- Production migration confirmed applied; app healthy; sign-in HTTP 200;
  anonymous products/catalog/thresholds HTTP 401. Public HTTPS remains HTTP 302 to
  existing Cloudflare Access. Nine production JS/CSS assets return 200 and include
  the manufacture editor, threshold refresh and mobile dialog constraints.
- Asset probe initially omitted global CSS from the shared /_app manifest; fixed
  the probe and reran successfully. No application repair was needed.
- Post-switch fingerprints exactly match the fresh snapshot for all original
  columns in 434 products, 106 catalog entries, one user/settings and zero accounts.
  Settings were preserved: current urgent threshold 3, warning threshold 100.
- Source checkout preserved; no Git commit/push, live integration sends or production
  data restoration. Actual phone camera recognition/keyboard checks remain with owner.
