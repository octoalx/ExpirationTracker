# Release preparation

Local task completion and release are separate outcomes. Deploy only when the
owner explicitly requests it; never infer permission from passing checks.

## Verified deployment target

ExpirationTracker production: `Alex@146.103.42.228:34657`, SSH workspace
`/home/Alex/ExpirationTracker`, public URL `https://expiry.axnode.xyz`.
Verified on 2026-10-03. Do not use `91.108.249.220:54783` from local SSH config;
it belongs to an unrelated stale target. Read this target and the latest deployment
plan before connecting. Preserve the active deployed catalog release when applying
UI-only commits; production currently includes catalog work outside Git HEAD.

Before release:

1. Identify the reviewed revision and confirm the target environment with the owner.
2. Require a committed package lock and reproducible dependency installation.
3. Run `npm run verify:release`; all required checks must pass. `test:app` covers
   startup isolation, account APIs, inventory/catalog imports, product lifecycle,
   shared-store authorization, fake notification transports and recovery. Review
   any remaining manual evidence and the specific release's integration coverage.
4. Review auth/ownership and admin boundaries, any migrations and scheduling changes.
5. Build and exercise the actual app in an isolated environment with disposable
   SQLite storage and fake email/Telegram delivery. Record commands and results.
6. Validate migrations on a copy of representative data; verify backup restoration
   in isolation. Agree a recovery procedure before touching production.
7. Review Docker/nginx changes and the deployment script. `deploy.sh` pulls main,
   stops containers and changes storage permissions; it is not a read-only check.
8. Deploy only within the requested scope, then inspect health and critical flows.

The verification report is evidence of executed checks, not authorization and not
a complete release certification. Build, runtime, integration and recovery evidence
are manual requirements until automated isolation is implemented. No production
hostname, SSH account or credentials have been inferred from PureRecipe.

## Continuous delivery

`.github/workflows/deploy-production.yml` performs a release after the owner starts
it by hand and approves the `production` environment. It never runs on a push, so
merging a pull request still does not deploy anything.

Inputs: `ref` (default `main`, resolved to an immutable SHA and rejected unless it
is already contained in `origin/main`), `dry_run` (back up and verify only) and
`allow_dirty` (deploy despite uncommitted changes on the host).

The sequence is `preflight -> backup -> deploy -> health check`, with an automatic
rollback to the previously running revision when the health check fails. Two helper
scripts run on the host:

- `scripts/release-backup.sh` takes a consistent SQLite snapshot (the database runs
  in WAL mode, so a file copy can miss committed transactions) and verifies it with
  `integrity_check`. It fails closed: no snapshot means no deploy.
- `scripts/release-healthcheck.sh` verifies container state through `docker inspect`,
  the promoted revision recorded in `.release-version`, and the local and public
  endpoints. It accepts any HTTP response below 500, because Cloudflare Access and
  the app's own session redirect are expected. The same script validates a rollback.

The rollback restores code only. Migrations are additive, and restoring a database
snapshot over live data is destructive, so it remains a separate explicit decision.
When a rollback itself fails, the run summary prints the snapshot path and the exact
recovery commands.

Required repository configuration: secret `PROD_SSH_KEY` (private key, owner-added),
environment `production` with the owner as required reviewer, and the matching public
key in `~/.ssh/authorized_keys` on the host. Optional variables `PROD_SSH_HOST`,
`PROD_SSH_PORT`, `PROD_SSH_USER`, `PROD_REMOTE_DIR` and `PROD_HOST_KEY_FINGERPRINT`
override the committed defaults. `scripts/deploy-workflow.mjs` asserts these safety
properties in `npm run test:harness`. Full design and evidence:
`docs/plans/2026-10-13-cd-production.md`.
