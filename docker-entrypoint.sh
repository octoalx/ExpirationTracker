#!/bin/sh
set -e

# Убеждаемся, что переменная БД установлена
export DATABASE_URL="file:/app/data/dev.db"

echo "Current user: $(whoami)"
echo "Checking database directory..."

# Создаем папку, если она не была создана (на всякий случай)
if [ ! -d "/app/data" ]; then
  mkdir -p /app/data
fi

# Verify writable
if [ ! -w "/app/data" ]; then
  echo "ERROR: /app/data is not writable by user $(whoami) (uid=$(id -u)). Fix: sudo chown -R 1001:1001 ./data on host."
  exit 1
fi

echo "Running Prisma migrations..."
# Database guard runs BEFORE `migrate deploy`, the earliest point in the container
# lifecycle.
#
# Why here and not only in instrumentation.ts: `prisma migrate deploy` opens the
# database to apply schema changes. In journal_mode=delete a leftover rollback
# journal with a corrupt header makes that open fail or hang, so the migration
# itself would wedge. WAL is forced first to remove that failure mode, and an
# unusable journal is moved aside before anything touches the database.
#
# Why an inline script instead of importing src/lib/server/sqlite-health.ts: the
# runtime image ships the standalone server and scripts/, not src/, so the module
# is not on disk at this point. This block is a deliberate, minimal duplicate of
# that module's logic; keep the two in step. The module remains the source of
# truth for the application, and the instrumentation hook repeats both steps at
# server startup as a second line of defence (WAL is a persistent property that
# external tooling can reset).
export DATABASE_URL="${DATABASE_URL:-file:/app/data/dev.db}"
node -e '
  const fs = require("fs");
  const path = require("path");
  const Database = require("better-sqlite3");
  const dbPath = process.env.DATABASE_URL.replace(/^file:/, "");
  const MAGIC = Buffer.from([0xd9, 0xd5, 0x05, 0xf9, 0x20, 0xa1, 0x63, 0xd7]);

  // A leftover rollback journal whose header cannot be a real journal is moved
  // (not deleted) aside so SQLite can open the database. A valid journal is left
  // for SQLite to roll back itself.
  const journal = dbPath + "-journal";
  if (fs.existsSync(journal)) {
    const size = fs.statSync(journal).size;
    const header = size >= 28 ? fs.readFileSync(journal).subarray(0, 8) : null;
    const valid = size === 0 || (header && header.equals(MAGIC));
    if (!valid) {
      const dir = path.join("/app", "backups", "journal-quarantine");
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, path.basename(journal) + "." + new Date().toISOString().replace(/[:.]/g, "-"));
      try { fs.renameSync(journal, target); }
      catch { fs.copyFileSync(journal, target); fs.unlinkSync(journal); }
      console.error("[Startup] Quarantined invalid SQLite journal (" + size + " bytes) -> " + target);
    }
  }

  const db = new Database(dbPath);
  try {
    const mode = db.pragma("journal_mode = WAL", { simple: true });
    db.pragma("synchronous = NORMAL");
    console.log("[Startup] SQLite journal_mode=" + mode);
    if (String(mode).toLowerCase() !== "wal") {
      console.error("[Startup] WARNING: could not force WAL (effective mode: " + mode + ")");
    }
  } finally { db.close(); }
'
# Выполняем миграции перед стартом
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Ensuring default admin user..."
# Создаем admin если нет пользователей
npx tsx /app/scripts/ensure-admin.ts

echo "Starting Next.js Standalone..."
# В режиме standalone главный файл — server.js
exec node server.js