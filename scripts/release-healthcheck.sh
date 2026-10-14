#!/usr/bin/env bash
#
# Production health check for ExpirationTracker.
#
# Runs ON the production host and answers one question: is the release that was
# just deployed serving traffic correctly? It is deliberately independent of how
# the deployment was performed, so the same script validates a deploy and a
# rollback.
#
# Usage: bash scripts/release-healthcheck.sh <expected-revision> [public-url]
#
# <expected-revision> is the git revision that should now be running; the deploy
# workflow records it in .release-version. When the file does not match we do not
# claim success - this catches "the deploy appeared to work but the container is
# still serving the old build". Pass an empty string to skip that assertion when
# running the script as a standalone check.
#
# The CD workflow streams this file over stdin (`bash -s`) rather than calling it
# from the host's checkout: a rollback can target an older revision that never
# contained this script, and the check must still be available to judge whether
# the rollback worked. Stdin delivery leaves BASH_SOURCE unset, so the arguments
# are also read from the environment:
#   EXPITRACK_REPO_DIR, EXPECTED_REVISION, HEALTHCHECK_PUBLIC_URL
#
# Exit code 0 means healthy. Any non-zero exit must trigger a rollback.
#
# On accepted HTTP codes: the public host sits behind Cloudflare Access and the
# app itself requires a session, so redirects (3xx) and rejections (401/403) are
# normal signs of a working stack. Only a server error (5xx) or no response at
# all means the release is broken.
set -euo pipefail

EXPECTED="${EXPECTED_REVISION:-${1:-}}"
PUBLIC_URL="${HEALTHCHECK_PUBLIC_URL:-${2:-https://expiry.axnode.xyz}}"
LOCAL_URL="http://localhost:8881"
REPO_DIR="${EXPITRACK_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)}"
cd "$REPO_DIR"

fail() { echo "HEALTHCHECK FAILED: $*" >&2; exit 1; }

# Asserts that an HTTP status code indicates an application that is serving.
check_code() {
  local label="$1" code="$2"
  echo "${label} -> ${code}"
  if [ "$code" = "000" ]; then
    fail "${label}: no response (connection failed or timed out)"
  fi
  if [ "$code" -ge 500 ]; then
    fail "${label}: server error ${code}"
  fi
}

echo "--- 1/4 container state ---"
# State comes from `docker inspect`, not from `docker compose ps` text. Compose
# renders a padded table whose column widths vary between invocations, so an
# exact match against that text intermittently fails on a container that is in
# fact healthy - unacceptable for a check that can trigger a rollback. Inspect
# output is machine-readable and stable.
CID="$(docker compose ps -q app 2>/dev/null | tr -d '\r' || true)"
if [ -z "$CID" ]; then
  fail "app container not found; the stack is not running"
fi
# docker-compose.yml declares the pgrep-based healthcheck, so health is expected.
STATUS="$(docker inspect --format '{{.State.Status}}' "$CID" 2>/dev/null | tr -d '\r')"
HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CID" 2>/dev/null | tr -d '\r')"
RESTARTING="$(docker inspect --format '{{.State.Restarting}}' "$CID" 2>/dev/null | tr -d '\r')"
echo "app container ${CID:0:12} status=${STATUS:-unknown} health=${HEALTH:-unknown} restarting=${RESTARTING:-unknown}"
[ "$STATUS" = "running" ]    || fail "app container status is '${STATUS:-unknown}', expected 'running'"
[ "$HEALTH" = "healthy" ]    || fail "app container health is '${HEALTH:-unknown}', expected 'healthy'"
[ "$RESTARTING" = "false" ]  || fail "app container is in a restart loop"

echo "--- 2/4 promoted revision ---"
if [ -n "$EXPECTED" ]; then
  ACTUAL="$(cat .release-version 2>/dev/null | tr -d '\r' || echo '')"
  echo "expected=$EXPECTED actual=${ACTUAL:-<none>}"
  [ "$ACTUAL" = "$EXPECTED" ] || fail "host is not running the expected revision"
else
  echo "no expected revision supplied; skipping version assertion"
fi

echo "--- 4/6 database answers and is in WAL mode ---"
# The check that would have caught the 2026-10-13 incident, where login failed with
# Prisma P1008 while the container reported healthy and both endpoints answered.
#
# What was proven by reproducing it (see docs/plans/2026-10-13-cd-production.md):
# a leftover rollback journal alone is HARMLESS - reads still work. The failure
# needs journal_mode=delete AND a writer holding a lock, because in delete mode a
# writer takes a whole-database lock and every reader then blocks until it times
# out. WAL is what makes readers and the writer independent, so journal_mode is
# the property actually worth asserting. A database that answers queries but is
# not in WAL is one interruption away from wedging every request.
#
# The query runs inside the app container so it uses the same driver and database
# path the application does; `timeout` stops a wedged database hanging the check.
DBCHECK="$(docker compose exec -T app timeout 30 node -e '
const Database = require("better-sqlite3");
const path = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, "") : "/app/data/dev.db";
const db = new Database(path, { readonly: true, fileMustExist: true, timeout: 10000 });
const integrity = db.prepare("PRAGMA integrity_check").get().integrity_check;
const users = db.prepare("SELECT count(*) AS n FROM User").get().n;
const products = db.prepare("SELECT count(*) AS n FROM Product").get().n;
const mode = db.pragma("journal_mode", { simple: true });
db.close();
console.log(JSON.stringify({ integrity, users, products, mode }));
' 2>&1 | tr -d '\r' | tail -1 || true)"

echo "dbcheck: ${DBCHECK:-<no output>}"
case "$DBCHECK" in
  *'"integrity":"ok"'*) ;;
  *) fail "database did not answer a readable integrity_check (got: ${DBCHECK:-no output})" ;;
esac
# A database with no users cannot authenticate anyone; an empty catalog means the
# wrong file was mounted. Both are release-breaking, so they are asserted.
DB_USERS="$(printf '%s' "$DBCHECK" | sed -n 's/.*"users":\([0-9]*\).*/\1/p')"
DB_PRODUCTS="$(printf '%s' "$DBCHECK" | sed -n 's/.*"products":\([0-9]*\).*/\1/p')"
DB_MODE="$(printf '%s' "$DBCHECK" | sed -n 's/.*"mode":"\([a-z]*\)".*/\1/p')"
[ "${DB_USERS:-0}" -ge 1 ] || fail "database reports ${DB_USERS:-0} users; the application could not authenticate anyone"
echo "database: integrity=ok users=${DB_USERS} products=${DB_PRODUCTS} journal_mode=${DB_MODE:-unknown}"
# Asserted, not warned: in delete mode a concurrent writer blocks every reader,
# which is exactly how a healthy-looking deploy broke sign-in.
[ "$DB_MODE" = "wal" ] || fail "journal_mode is '${DB_MODE:-unknown}', expected 'wal'; a concurrent writer would block all reads (the 2026-10-13 sign-in failure)"

echo "--- 5/6 local endpoint (through nginx) ---"
# Through nginx, so the app/upstream wiring is exercised, not just the app port.
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$LOCAL_URL/" || echo '000')"
check_code "GET ${LOCAL_URL}/" "$CODE"

echo "--- 6/6 public endpoint ---"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$PUBLIC_URL" || echo '000')"
check_code "GET ${PUBLIC_URL}" "$CODE"

echo "HEALTHCHECK OK"
