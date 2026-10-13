# Continuous delivery for production

## Goal and acceptance criteria

Production can be released by a GitHub Actions workflow that a human starts
explicitly and approves, with no way for a merge to deploy on its own.

Acceptance criteria:

1. Delivery is manual: the workflow is triggered only by `workflow_dispatch`.
   A push to `main` never deploys.
2. The deploy job is bound to the `production` GitHub Environment, which requires
   a reviewer, so the run pauses for approval after it is started.
3. The deployed revision is an immutable commit that is already contained in
   `origin/main`; a moving branch name is resolved to a SHA before anything runs.
4. Order is enforced: database backup, then rebuild and restart, then health
   check. Any failure after the backup triggers an automatic rollback to the
   revision that was running before.
5. The SSH private key is read only from the repository secret `PROD_SSH_KEY`
   and never appears in the repository, the workflow file or the logs.
6. A failed rollback reports the backup path and the exact recovery commands
   instead of leaving production in an unknown state.
7. `npm run test:harness` fails if the workflow loses any of the properties above.

## Scope and approach

Added:

- `.github/workflows/deploy-production.yml` - the delivery workflow.
- `scripts/release-backup.sh` - consistent SQLite snapshot taken on the host.
- `scripts/release-healthcheck.sh` - health check shared by deploy and rollback.
- `scripts/deploy-workflow.mjs` - structural check of the workflow's safety
  properties, wired into the existing harness tests.

Changed:

- `.gitignore` - ignore `.release-version`, the file the workflow writes on the
  host to record the running revision.

Not changed: `deploy.sh`, `Dockerfile`, `docker-compose.yml`, the database schema
and the production `.env`. The workflow applies the revision itself instead of
calling `deploy.sh`, because `deploy.sh` runs `git pull origin main` and would
discard the pinned revision.

### Why the workflow does not reuse deploy.sh

`deploy.sh` is a manual operator script: it pulls `main`, stops containers, builds
and restarts. Two of its behaviours are wrong for CD - an unpinned revision and a
stop-then-start window - so the workflow performs the same *effects* (build,
restart) against an exact SHA. The script stays valid for manual use.

### Backup must precede the rebuild

`scripts/release-backup.sh` snapshots the database through SQLite's online backup
API inside the running app container. The database runs in WAL mode, so a plain
file copy can silently miss committed transactions; the API reads through a
consistent transaction instead. The snapshot is verified with `PRAGMA
integrity_check` and the step fails closed: if no usable snapshot is produced,
nothing is rebuilt.

### Rollback scope

The rollback restores the previous *code* revision and re-runs the health check.
It deliberately does not restore the database. Migrations in this project are
additive, and restoring a snapshot over live data is a destructive operation that
must be a separate, explicit decision by the owner.

## Risks and invariants

- **Overwriting uncommitted production work.** The host was deployed manually for
  weeks, so its working tree carries CRLF line endings (the repository is LF-only)
  and a checkout older than `main`. Before deploying, the workflow compares the
  tree to its HEAD with `git diff --ignore-cr-at-eol --numstat` and refuses to
  continue when real (non-EOL) differences exist, unless `allow_dirty` is set.
  `--numstat` is used because `--name-only` still lists every file whose line
  endings differ, which is useless for telling real edits from churn.
- **Host identity.** The ed25519 host key of `146.103.42.228:34657` is pinned in
  the workflow (`SHA256:M2GPi3L1rFKFttfszMzEoM3/dK9eyU4waFhJ9N4j6u0`, recorded
  2026-10-13). A changed key stops the deploy rather than silently trusting a
  different host. `known_hosts` is populated by `ssh-keyscan` and then compared
  against the pin.
- **Secret handling.** The key is written to a `600` file on the runner only.
  `set -euo pipefail` is active and the key is never echoed. Remote scripts are
  delivered over stdin with a quoted heredoc, so a quoting mistake cannot leak or
  mis-parse them.
- **Health check must not lie.** The check reads container state from
  `docker inspect`, not from `docker compose ps` text: compose renders a padded
  table whose column widths vary between invocations, and an exact match against
  it intermittently failed on a healthy container. HTTP responses below 500 are
  accepted because Cloudflare Access and the app's own session redirect (observed
  307 locally, 302 publicly); only a 5xx or no response is a failure.
- **No approval bypass.** The environment's required reviewer is the owner. Note
  that `prevent_self_review` is false and `can_admins_bypass` is true, so the
  owner's own approval is not an independent second pair of eyes; the real
  guarantee is that the run can only start by hand.
- **Time zone and scheduling.** The CD workflow changes neither `TZ` nor cron
  configuration. Notification behaviour is untouched.

## Verification

Executed locally and against production on 2026-10-13.

| Check | Result |
| --- | --- |
| `bash -n` on all 14 workflow shell blocks | PASS |
| `bash -n` on both helper scripts | PASS |
| YAML parses (`js-yaml`) | PASS |
| `node scripts/deploy-workflow.mjs` | PASS |
| `npm run test:harness` (Node 22) | 6 tests, 6 pass, 0 fail |
| `git diff --ignore-cr-at-eol --numstat` on the host | 11 files: the whole diff is `main` being newer, no production-only code |
| `scripts/release-backup.sh cd-test` on the host | PASS - snapshot created, `integrity_check` = ok, 438 products read; artifact removed afterwards |
| `scripts/release-healthcheck.sh ""` on the host | PASS, exit 0, stable across 3 repeats |
| `scripts/release-healthcheck.sh <wrong sha>` on the host | FAIL, exit 1 - the revision assertion has teeth |
| `scripts/release-healthcheck.sh <running sha>` with `.release-version` set | PASS, exit 0 |
| Host restored to its prior state | 158 dirty entries, 12 untracked, 23 backups, no test artifacts |

`npm run verify:release` is expected to report FAIL for the `published source`
check until this branch is merged: the release profile requires HEAD to already be
in `origin/main` by design.

Not verified: an actual deployment end to end, because deployment requires the
owner's explicit command. `notificationService.ts` and
`tests/catalog-api.test.cjs` differ between the host tree and `main`; in both cases
`main` is newer, so the first CD run will move production forward by that content.

## Follow-up: the first run could not take a backup

The first manual run (2026-10-13, dry run) failed at the backup step with exit 127:
`bash: scripts/release-backup.sh: No such file or directory`. The workflow called the
helper from the host's checkout, but on the first deploy the host tree is still the
older revision that has no `scripts/` directory, while the checkout that brings them
runs later in the same job. The backup step is deliberately first and fail-closed, so
it blocked the deploy correctly - but no usable backup was produced, and the first
deploy could therefore never succeed.

Fix: the helpers are sent from the checkout being deployed instead of being read from
the host, so they exist regardless of the host tree state and always match the
revision under test. Two details matter:

- They are written to a file on the host and run from there, **not** piped into
  `bash -s`. A script fed on stdin shares that stream with its own commands' stdin, so
  the first command that reads input (`docker compose exec -T`) consumes the remainder
  of the script: the snapshot was taken, the script then stopped silently, exited 0 and
  never printed `BACKUP_FILE`. The workflow would have reported "Backup did not report
  a file" while a 98 MB snapshot sat on disk. This was caught by running the real
  helper against the live host before the fix shipped.
- Every container `exec` in the backup helper redirects `< /dev/null`, so the helper
  can never consume the stdin it was loaded from.

Verified against the live host with its tree still lacking `scripts/`: the backup
reported `BACKUP_FILE`, the health check passed with the expected revision and failed
with a wrong one, the temporary helper was removed afterwards, and the host was left
at its baseline (23 backups, no `.release-version`).

## Result and handoff

The workflow, both helper scripts and the structural check are implemented and
exercised against the live host with no change to production state.

Before the first real deploy:

1. Add the repository secret `PROD_SSH_KEY` (owner).
2. Create the `production` environment with the owner as required reviewer (owner).
3. Add the deploy public key to `~/.ssh/authorized_keys` on the host (owner).
4. Run the workflow once with `dry_run: true` and `allow_dirty: true` to confirm
   SSH, workspace, `.env`, docker compose and the backup against the host.
5. Run it for real with `allow_dirty: true`, because the host tree still differs
   from `main` by the 11 files above. After that first run the tree matches HEAD
   and `allow_dirty` is no longer needed.

Next useful step: an end-to-end deploy rehearsal on a disposable host, so the
rollback path is exercised for real rather than only unit-checked.
