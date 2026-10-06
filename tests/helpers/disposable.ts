import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { TestContext } from "node:test";

export function migrations() {
  return fs.readdirSync("prisma/migrations").sort().filter(name => fs.existsSync(`prisma/migrations/${name}/migration.sql`));
}
export function migrate(db: Database.Database, names = migrations()) {
  for (const name of names) db.exec(fs.readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
}
export async function disposable(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expiry-telegram-"));
  const url = path.join(dir, "test.db");
  const sqlite = new Database(url);
  migrate(sqlite); sqlite.close();
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  t.after(async () => {
    await db.$disconnect();
    const resolved = path.resolve(dir);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("expiry-telegram-")) throw new Error("Unexpected test storage");
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { db, dir, url };
}
export async function storeFixture(t: TestContext) {
  const fixture = await disposable(t);
  for (const id of ["manager", "employee", "outsider"]) await fixture.db.user.create({ data: {
    id, name: id, email: `${id}@example.invalid`, settings: { create: {} } } });
  await fixture.db.store.create({ data: { id: "main", name: "Test store" } });
  for (const id of ["manager", "employee"]) await fixture.db.storeMembership.create({ data: {
    userId: id, storeId: "main", role: id === "manager" ? "MANAGER" : "EMPLOYEE" } });
  return fixture;
}
