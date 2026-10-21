import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

/**
 * Pending migrations that cannot run while department-less product rows exist.
 * Each one rebuilds Product with a mandatory storeId, so a single row without a
 * department aborts it with "NOT NULL constraint failed" and rolls the migration
 * back. The repair below therefore runs immediately before such a migration.
 */
const REQUIRES_DEPARTMENT = new Set(["20261022000000_product_store_required"]);

/**
 * Drops products that belong to no department and returns how many were removed.
 * A department is the only product scope, so such a row can never be listed by
 * anybody and the current schema refuses to store it: a restored copy must not
 * keep rows the application can no longer open. The caller reports the count, so
 * the loss is visible to the operator instead of silent.
 *
 * The referential actions the schema declares are applied by hand because this
 * repair runs outside a transaction, where SQLite ignores the `PRAGMA
 * foreign_keys` switching the migration files do.
 */
export function dropProductsWithoutDepartment(db: Database.Database) {
  const columns = new Set((db.pragma("table_info(Product)") as Array<{ name: string }>).map(row => row.name));
  if (!columns.has("storeId")) return 0;
  const orphans = db.prepare("SELECT COUNT(*) AS n FROM Product WHERE storeId IS NULL").get() as { n: number };
  if (!orphans.n) return 0;
  // ProductClaim cascades from Product. ProductEvent keeps its row but loses the
  // reference, which is the ON DELETE SET NULL the schema promises.
  db.exec("DELETE FROM ProductClaim WHERE productId IN (SELECT id FROM Product WHERE storeId IS NULL);"
    + "UPDATE ProductEvent SET productId = NULL WHERE productId IN (SELECT id FROM Product WHERE storeId IS NULL);"
    + "DELETE FROM Product WHERE storeId IS NULL;");
  return orphans.n;
}

/** The upgraded copy plus the row loss the operator has to be told about. */
export interface PreparedSnapshot {
  /** Copy that may replace the live database. */
  path: string;
  /** Products dropped because they belonged to no department. */
  droppedProducts: number;
}

/** Upgrade and validate a temporary copy before replacing the requested database. */
export function prepareSnapshot(source: string, directory: string): PreparedSnapshot {
  const prepared = path.join(directory, `restore-${randomUUID()}.db`);
  fs.copyFileSync(source, prepared);
  const db = new Database(prepared);
  let droppedProducts = 0;
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
        if (REQUIRES_DEPARTMENT.has(name)) droppedProducts += dropProductsWithoutDepartment(db);
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
      // A legacy export knows an owner for every row but no department, and the
      // store schema it was just upgraded to leaves storeId empty. The current
      // schema cannot hold such a row, so it is dropped here and counted.
      droppedProducts += dropProductsWithoutDepartment(db);
    }
    db.exec("INSERT INTO IntegrationState(id,paused) VALUES ('telegram',1) ON CONFLICT(id) DO UPDATE SET paused=1; DELETE FROM ProductClaim; DELETE FROM TelegramButton; DELETE FROM TelegramLinkRequest; UPDATE TelegramUpdate SET state='CANCELLED',payload='{}',leaseUntil=NULL WHERE state IN ('QUEUED','PROCESSING'); UPDATE TelegramDelivery SET state='CANCELLED',leaseUntil=NULL WHERE state IN ('QUEUED','PROCESSING');");
    if (db.pragma("foreign_key_check").length) throw new Error("Snapshot references are invalid");
    return { path: prepared, droppedProducts };
  } catch (error) { db.close(); fs.unlinkSync(prepared); throw error; }
  finally { if (db.open) db.close(); }
}
