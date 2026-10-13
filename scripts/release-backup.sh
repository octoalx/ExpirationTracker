#!/usr/bin/env bash
#
# Consistent SQLite snapshot of the production database, taken from inside the
# running app container.
#
# Why not `cp data/dev.db`: the application runs SQLite in WAL mode, so committed
# transactions may still live in dev.db-wal and a plain file copy would silently
# produce a stale backup. The container image ships Node and better-sqlite3, so we
# use SQLite's online backup API (better-sqlite3 `db.backup`) which reads through
# a consistent read transaction and captures WAL contents.
#
# Usage (on the production host, from the repository directory):
#   bash scripts/release-backup.sh [label]
#
# Prints "BACKUP_FILE=<name>" and "BACKUP_SIZE=<bytes>" on success so a caller
# (the CD workflow, or a human) can parse the result without reading the log.
# Exit code is non-zero when no usable snapshot was produced, which must stop a
# deployment before it starts.
set -euo pipefail

LABEL="${1:-manual}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Keep the name filesystem- and shell-safe; the label comes from a workflow input.
LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-40)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="expitrack-pre-deploy-${STAMP}-${LABEL}.db"

mkdir -p ./backups

if ! docker compose ps --status running --services 2>/dev/null | grep -qx app; then
  echo "ERROR: the 'app' container is not running; refusing to snapshot." >&2
  echo "       A deploy that cannot back up must not proceed." >&2
  exit 1
fi

# Run the snapshot inside the container: it needs the same better-sqlite3 build
# the app uses, and /app/data is the volume mounted from ./data.
CMD=$(cat <<'NODE'
const Database = require("better-sqlite3");
const target = process.argv[1];
const db = new Database("/app/data/dev.db", { readonly: true, fileMustExist: true });
db.backup(target).then(() => { db.close(); }).catch((err) => {
  console.error(String(err));
  process.exit(1);
});
NODE
)

# The backup lands in /app/backups, which docker-compose.yml mounts from ./backups,
# so it is visible on the host at ./backups/<name> without a docker cp step.
docker compose exec -T app node -e "$CMD" "/app/backups/${NAME}"

HOST_PATH="./backups/${NAME}"
if [ ! -s "$HOST_PATH" ]; then
  echo "ERROR: backup file ${HOST_PATH} is missing or empty." >&2
  exit 1
fi

# A snapshot that cannot be opened as SQLite is not a backup. integrity_check is
# read-only and cheap for this database size.
INTEGRITY="$(docker compose exec -T app node -e '
const Database = require("better-sqlite3");
try {
  const db = new Database(process.argv[1], { readonly: true, fileMustExist: true });
  const row = db.prepare("PRAGMA integrity_check").get();
  db.close();
  console.log(row.integrity_check);
} catch (err) { console.log("ERROR: " + String(err)); process.exit(1); }
' "/app/backups/${NAME}" | tr -d '\r')"

if [ "$INTEGRITY" != "ok" ]; then
  echo "ERROR: integrity_check on the snapshot returned '${INTEGRITY}'." >&2
  exit 1
fi

SIZE="$(wc -c < "$HOST_PATH" | tr -d ' ')"

# Retention: the app itself keeps 30 backups (src/lib/backupService.ts). Retention
# here only bounds pre-deploy snapshots so a long CD history cannot fill the disk.
KEEP=30
mapfile -t OLD < <(ls -1tr ./backups/expitrack-pre-deploy-*.db 2>/dev/null | head -n -"$KEEP" || true)
for file in "${OLD[@]:-}"; do
  [ -n "$file" ] || continue
  rm -f "$file"
  echo "Removed old pre-deploy snapshot: ${file}"
done

echo "BACKUP_FILE=${NAME}"
echo "BACKUP_SIZE=${SIZE}"
echo "BACKUP_PATH=${HOST_PATH}"
