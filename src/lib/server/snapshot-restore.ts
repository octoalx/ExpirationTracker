import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

/** Upgrade and validate a temporary copy before replacing the requested database. */
export function prepareSnapshot(source: string, directory: string) {
  const prepared = path.join(directory, `restore-${randomUUID()}.db`);
  fs.copyFileSync(source, prepared);
  const db = new Database(prepared);
  try {
    if (db.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("Invalid SQLite snapshot");
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row: any) => row.name));
    if (!tables.has("Product") || !tables.has("User")) throw new Error("Not an application snapshot");
    const migrationRoot = path.join(process.cwd(), "prisma/migrations");
    if (tables.has("_prisma_migrations")) {
      const history = db.prepare('SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations').all() as Array<{ migration_name: string; finished_at: unknown; rolled_back_at: unknown }>;
      if (history.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error("Snapshot has an incomplete migration");
      const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
      for (const name of fs.readdirSync(migrationRoot).sort().filter(name => fs.existsSync(path.join(migrationRoot, name, "migration.sql")))) {
        if (applied.has(name)) continue;
        const sql = fs.readFileSync(path.join(migrationRoot, name, "migration.sql"), "utf8");
        db.exec(sql);
        db.prepare('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES (?,?,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP,1)')
          .run(randomUUID(), createHash("sha256").update(sql).digest("hex"), name);
      }
    } else {
      // Untracked legacy exports support the pre-store schema without inventing migration history.
      const columns = new Set(db.pragma("table_info(Product)").map((row: any) => row.name));
      for (const [name, type] of [["manufacturingDate", "TEXT"], ["shelfLife", "INTEGER"], ["shelfLifeUnit", "TEXT"]]) {
        if (!columns.has(name)) db.exec(`ALTER TABLE Product ADD COLUMN ${name} ${type}`);
      }
      if (!tables.has("Store")) db.exec(fs.readFileSync(path.join(migrationRoot, "20261006000000_telegram_store_assistant/migration.sql"), "utf8"));
    }
    db.exec("INSERT INTO IntegrationState(id,paused) VALUES ('telegram',1) ON CONFLICT(id) DO UPDATE SET paused=1; DELETE FROM ProductClaim; DELETE FROM TelegramButton; DELETE FROM TelegramLinkRequest; UPDATE TelegramUpdate SET state='CANCELLED',payload='{}',leaseUntil=NULL WHERE state IN ('QUEUED','PROCESSING'); UPDATE TelegramDelivery SET state='CANCELLED',leaseUntil=NULL WHERE state IN ('QUEUED','PROCESSING');");
    if (db.pragma("foreign_key_check").length) throw new Error("Snapshot references are invalid");
    return prepared;
  } catch (error) { db.close(); fs.unlinkSync(prepared); throw error; }
  finally { if (db.open) db.close(); }
}
