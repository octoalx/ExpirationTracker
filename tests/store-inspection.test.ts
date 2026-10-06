import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { disposable, storeFixture, migrate, migrations } from "./helpers/disposable";
import { accessibleProduct, claimProduct, inspectProduct, inventoryScope, updateInventory, worklist, requireManager } from "../src/lib/server/inventory";
import { transferPreview, transferStore } from "../src/lib/server/store-transfer";
import { expiryDays, expiryDisplay, minskDate, expiredOn } from "../src/lib/expiry-calendar";
import { copySqliteSnapshot } from "../src/lib/server/sqlite-snapshot";
import { prepareSnapshot } from "../src/lib/server/snapshot-restore";
import { exportStoreBackup, parseStoreBackup, prepareStoreRestore, restoreStoreHeader, restoreStoreDetails } from "../src/lib/server/store-backup";

const now = new Date("2026-10-06T10:00:00+03:00");
const employee = { userId: "employee", source: "WEB" as const };
const manager = { userId: "manager", source: "WEB" as const };
const record = { id: "batch", name: "Batch", barcode: "0123456789012", expiryDate: new Date("2026-10-07"), userId: "employee", storeId: "main", quantity: null };

test("Minsk calendar boundaries ignore device timezone and preserve date-only labels", () => {
  const before = new Date("2026-10-06T20:59:59Z"), after = new Date("2026-10-06T21:00:00Z");
  assert.equal(minskDate(before), "2026-10-06"); assert.equal(minskDate(after), "2026-10-07");
  assert.equal(expiryDays("2026-10-06", before), 0); assert.equal(expiredOn("2026-10-06", before), false);
  assert.equal(expiryDays("2026-10-06", after), -1); assert.equal(expiredOn("2026-10-06", after), true);
  assert.equal(expiryDays(null, after), null); assert.equal(expiryDays("invalid", after), null);
  assert.equal(expiryDisplay("2026-10-06T00:00:00Z"), "06.10.2026");
  assert.equal(expiryDays("2027-01-01", new Date("2026-12-31T23:59:00+03:00")), 1);
});

test("SQLite snapshot captures committed WAL data and legacy tracked snapshots apply every pending migration", async t => {
  const { dir } = await disposable(t);
  const source = `${dir}/wal.db`, copied = `${dir}/copied.db`;
  const db = new Database(source);
  db.pragma("journal_mode = WAL"); db.pragma("wal_autocheckpoint = 0");
  const applied = migrations().filter(name => name < "20261002000000");
  migrate(db, applied);
  db.exec("CREATE TABLE _prisma_migrations(id TEXT PRIMARY KEY,checksum TEXT,finished_at DATETIME,migration_name TEXT,started_at DATETIME,applied_steps_count INTEGER,rolled_back_at DATETIME); INSERT INTO User(id) VALUES('owner'); INSERT INTO Product(id,name,barcode,userId,updatedAt) VALUES('wal','Committed WAL','01234567','owner',CURRENT_TIMESTAMP);");
  for (const name of applied) db.prepare("INSERT INTO _prisma_migrations(id,migration_name,finished_at) VALUES(?,?,CURRENT_TIMESTAMP)").run(name, name);
  assert.ok(fs.statSync(`${source}-wal`).size > 0);
  await copySqliteSnapshot(source, copied);
  const prepared = prepareSnapshot(copied, dir), restored = new Database(prepared);
  assert.equal((restored.prepare("SELECT name FROM Product WHERE id='wal'").get() as any).name, "Committed WAL");
  assert.equal((restored.prepare("SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL").get() as any).n, migrations().length);
  assert.deepEqual(restored.pragma("foreign_key_check"), []);
  restored.close(); db.close();
});

test("incremental migration and prepared legacy snapshot preserve every legacy product field", async t => {
  const { dir } = await disposable(t);
  const source = `${dir}/legacy.db`;
  const sql = new Database(source);
  migrate(sql, migrations().filter(name => name < "20261006000000"));
  sql.exec("INSERT INTO User(id) VALUES('owner'); INSERT INTO Product(id,name,barcode,quantity,status,updatedAt,userId) VALUES('old','Original','01234567',NULL,'DEFECT',CURRENT_TIMESTAMP,'owner');");
  const before = sql.prepare("SELECT * FROM Product").get() as any;
  sql.close();
  const prepared = prepareSnapshot(source, dir);
  const restored = new Database(prepared);
  const after = restored.prepare("SELECT * FROM Product").get() as any;
  for (const key of Object.keys(before)) assert.equal(after[key], before[key], key);
  assert.equal(after.storeId, null); assert.equal(after.version, 0);
  assert.equal((restored.prepare("SELECT paused FROM IntegrationState").get() as any).paused, 1);
  assert.deepEqual(restored.pragma("foreign_key_check"), []);
  restored.close(); fs.unlinkSync(prepared);
  const untouched = new Database(source); assert.equal((untouched.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='Store'").get() as any).n, 0); untouched.close();
});

test("explicit transfer preserves IDs and timestamps, keeps duplicate batches and excludes unselected owners", async t => {
  const { db } = await disposable(t);
  for (const id of ["manager", "employee", "outsider"]) await db.user.create({ data: { id, email: `${id}@example.invalid` } });
  await db.settings.create({ data: { userId: "manager", urgentThreshold: 2, warningThreshold: 9 } });
  const first = await db.product.create({ data: { ...record, storeId: null } });
  await db.product.create({ data: { ...record, id: "duplicate", storeId: null, userId: "manager", status: "ARCHIVED" } });
  await db.product.create({ data: { ...record, id: "private", storeId: null, userId: "outsider" } });
  const users = ["manager", "employee"];
  const preview = await transferPreview(db, "manager", users);
  assert.equal(preview.records, 2); assert.equal(preview.possibleDuplicates, 2);
  const result = await transferStore(db, "manager", { managerId: "manager", userIds: users, name: "Store", digest: preview.digest });
  assert.equal(result.transferred, 2); assert.equal(result.store.warningThreshold, 9);
  const after = await db.product.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(after.createdAt.getTime(), first.createdAt.getTime()); assert.equal(after.updatedAt.getTime(), first.updatedAt.getTime());
  assert.equal(after.quantity, null); assert.equal(after.userId, "employee");
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: "private" } })).storeId, null);
  assert.equal(await db.product.count({ where: (await inventoryScope(db, "employee")).where }), 2);
  assert.equal(await db.product.count({ where: (await inventoryScope(db, "outsider")).where }), 1);
  const repeated = await transferPreview(db, "manager", users);
  assert.equal((await transferStore(db, "manager", { managerId: "manager", userIds: users, name: "Store", digest: repeated.digest })).transferred, 0);
  assert.equal(await db.productEvent.count({ where: { action: "TRANSFER" } }), 2);
});

test("stale transfer preview rolls back membership and leaves inventory untouched", async t => {
  const { db } = await disposable(t);
  await db.user.create({ data: { id: "manager" } });
  const preview = await transferPreview(db, "manager", ["manager"]);
  await db.product.create({ data: { ...record, userId: "manager", storeId: null } });
  await assert.rejects(transferStore(db, "manager", { managerId: "manager", userIds: ["manager"], name: "Store", digest: preview.digest }), { status: 409 });
  assert.equal(await db.store.count(), 0); assert.equal(await db.storeMembership.count(), 0);
});

test("claims are exclusive, expire, and inspection requires a current version and claim", async t => {
  const { db } = await storeFixture(t); await db.product.create({ data: record });
  await assert.rejects(accessibleProduct(db, "outsider", record.id), { status: 404 });
  await assert.rejects(requireManager(db, "employee"), { status: 403 });
  await claimProduct(db, employee, record.id, false, now);
  await assert.rejects(claimProduct(db, manager, record.id, false, now), { status: 409 });
  const later = new Date(now.getTime() + 600001);
  await claimProduct(db, manager, record.id, false, later);
  await assert.rejects(inspectProduct(db, employee, record.id, 0, "CHECKED", "wrong", later), { status: 409 });
  await updateInventory(db, manager, record.id, 0, { name: "Changed" });
  await assert.rejects(inspectProduct(db, manager, record.id, 0, "SOLD", "stale", later), { status: 409 });
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: record.id } })).status, "ACTIVE");
});

test("checked and missing stay active; repeated result is idempotent; sold/removed/defect close whole batches", async t => {
  const { db } = await storeFixture(t); await db.product.create({ data: record });
  await claimProduct(db, employee, record.id, false, now);
  const checked = await inspectProduct(db, employee, record.id, 0, "CHECKED", "check", now);
  assert.equal(checked.status, "ACTIVE"); assert.equal(checked.version, 1);
  await inspectProduct(db, employee, record.id, 0, "CHECKED", "check", now);
  assert.equal(await db.productEvent.count(), 1);
  assert.equal((await worklist(db, "employee", now)).products.some(p => p.id === record.id), false);
  await claimProduct(db, employee, record.id, false, now);
  const missing = await inspectProduct(db, employee, record.id, 1, "MISSING", "missing", now);
  assert.equal(missing.status, "ACTIVE"); assert.equal(missing.missing, true);
  assert.equal((await worklist(db, "manager", now)).products.some(p => p.id === record.id), true);
  for (const result of ["SOLD", "REMOVED", "DEFECT"] as const) {
    const p = await db.product.create({ data: { ...record, id: result, quantity: 5 } });
    await claimProduct(db, employee, p.id, false, now);
    const closed = await inspectProduct(db, employee, p.id, 0, result, result, now);
    assert.equal(closed.status, result === "DEFECT" ? "DEFECT" : "ARCHIVED");
    assert.equal(closed.resolution, result); assert.equal(closed.quantity, 5);
  }
  assert.equal((await worklist(db, "employee", now)).counts.resolved, 3);
});

test("expired checked records remain actionable and revocation blocks old claims", async t => {
  const { db } = await storeFixture(t);
  await db.product.create({ data: { ...record, expiryDate: new Date("2026-10-05") } });
  await claimProduct(db, employee, record.id, false, now);
  await inspectProduct(db, employee, record.id, 0, "CHECKED", "checked-expired", now);
  const list = await worklist(db, "manager", now);
  assert.equal(list.counts.expired, 1); assert.equal(list.products.length, 1);
  await db.storeMembership.delete({ where: { userId: "employee" } });
  await assert.rejects(accessibleProduct(db, "employee", record.id), { status: 404 });
  await db.user.delete({ where: { id: "employee" } });
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: record.id } })).userId, null);
  assert.equal((await db.productEvent.findFirstOrThrow()).actorName, "employee");
});

test("store backup round trip restores ownership/history and cancels pending external work", async t => {
  const { db } = await storeFixture(t); await db.product.create({ data: record });
  await claimProduct(db, employee, record.id, false, now);
  await inspectProduct(db, employee, record.id, 0, "MISSING", "event", now);
  await db.telegramLink.create({ data: { userId: "employee", telegramUserId: "101", chatId: "101", displayName: "Employee" } });
  await db.telegramDelivery.create({ data: { userId: "employee", key: "pending", kind: "URGENT", scheduleDate: "2026-10-06" } });
  const extension = parseStoreBackup(JSON.parse(JSON.stringify(await exportStoreBackup(db))));
  await db.$transaction(async tx => {
    await prepareStoreRestore(tx, true);
    await restoreStoreHeader(tx, extension, new Map(), false);
    await restoreStoreDetails(tx, extension, new Map());
  });
  assert.equal((await db.telegramDelivery.findUniqueOrThrow({ where: { key: "pending" } })).state, "CANCELLED");
  assert.equal((await db.integrationState.findUniqueOrThrow({ where: { id: "telegram" } })).paused, true);
  assert.equal(await db.telegramLink.count(), 1); assert.equal(await db.productEvent.count(), 1);
  assert.equal(await db.storeMembership.count(), 2);
});
