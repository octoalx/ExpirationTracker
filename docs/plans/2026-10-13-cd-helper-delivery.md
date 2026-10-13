# CD helper delivery on a first deploy

## Problem

The first dry run of `deploy-production.yml` (2026-10-13 06:33 UTC, SHA `73fa3f6`)
failed at the backup step:

```
bash: scripts/release-backup.sh: No such file or directory
Process completed with exit code 127.
```

The workflow's own sequence put the backup before the deploy, then ran it as
`bash scripts/release-backup.sh` *from the host checkout*. On a first deploy the
host tree is an older revision (`ded6d715`, 28 commits behind `main`) that does
not contain `scripts/release-backup.sh` at all — that file only arrives with the
deploy step that runs later. The gate could never pass on a host whose tree
predates the CD work, which is exactly the situation of a first run.

## Fix

Both helpers are now delivered from the runner's checkout to `/tmp` on the host
instead of being read from the host tree:

```
ssh ... "cd '$REMOTE_DIR' && cat > $HELPER && ... bash $HELPER; rc=\$?; rm -f $HELPER; exit \$rc" \
  < scripts/release-backup.sh
```

A helper written to a file on the host and run from there cannot be truncated by
its own child commands. Feeding it via `bash -s` was rejected: a script on stdin
shares that stream with its commands, so `docker compose exec -T` consumed the
rest of the script — the snapshot was taken, then the script stopped silently,
exited 0 and never printed `BACKUP_FILE`.

`release-healthcheck.sh` already used this pattern for the rollback path, for the
same underlying reason (a rollback can target an older revision that never
contained the script). This change applies it to the backup and the forward
health check too, so no step depends on the host tree carrying CD's own tooling.

Delivered by PR #12 (`7cd06f3`), merged as `4d014c6`.

## Verification

| Check | Result |
| --- | --- |
| `bash .verification/run-verify-release.sh` on `4d014c6` | PASS, all 5 checks (app 85/85, 0 skipped) |
| Dry run 38361289000, `dry_run=true`, `allow_dirty=true`, SHA `4d014c6` | success in 24s |
| Backup produced | `expitrack-pre-deploy-20261013T103654Z-4d014c6cea40.db`, 98 205 696 bytes, `integrity_check` ok |
| Probe on host | HEAD `ded6d715`, `.release-version` none, 157 raw dirty entries, **11** real differences |
| Rollback target recorded | `ded6d7151dcdd8d98a76b703b880bbb5830826f2` |
| Host after the dry run | unchanged: HEAD `ded6d715`, `.release-version` still absent |

## Result

The dry run now completes and reports the backup name and the revision it would
deploy. A first real deploy remains the owner's explicit decision. Still
unverified: the deploy step itself, the health check against a live promotion,
and a real rollback.
