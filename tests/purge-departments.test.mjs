import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import Database from "better-sqlite3";

// The shared fixture helper is TypeScript and compiles to CommonJS, so named
// imports from ESM fail; require() reaches it through the same tsx loader.
const require = createRequire(import.meta.url);
const { migrate } = require("./helpers/disposable.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Disposable database with the production shape: a department, members, and rows everywhere. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expiry-purge-"));
  const source = path.join(dir, "dev.db");
  const db = new Database(source);
  migrate(db);
  db.exec(`INSERT INTO User (id,name,email,role) VALUES
      ('admin','Администратор','admin@localhost','ADMIN'),('manager','Стройка','stroika@diy.by','USER'),
      ('employee','Краски','kraski@diy.by','USER'),('oleg','Олег','oleg@example.invalid','USER');
    INSERT INTO Settings (id,userId) VALUES ('s1','admin'),('s2','manager'),('s3','employee'),('s4','oleg');
    INSERT INTO Store (id,name,urgentThreshold,warningThreshold) VALUES ('main','Магазин',3,100);
    INSERT INTO StoreMembership (id,storeId,userId,role) VALUES
      ('m1','main','admin','MANAGER'),('m2','main','manager','EMPLOYEE'),('m3','main','employee','EMPLOYEE');
    INSERT INTO Product (id,name,barcode,status,updatedAt,userId,storeId,version) VALUES
      ('p1','Товар','0123456789012','ACTIVE',CURRENT_TIMESTAMP,'admin','main',0),
      ('p2','Товар','0123456789013','ARCHIVED',CURRENT_TIMESTAMP,'oleg','main',0);
    INSERT INTO ProductClaim (productId,userId,expiresAt) VALUES ('p1','manager',CURRENT_TIMESTAMP);
    INSERT INTO ProductEvent (id,actorId,actorName,source,action,details,key,productId,storeId) VALUES
      ('e1','admin','Администратор','WEB','CREATE','{}','k1','p1','main');
    INSERT INTO TelegramLink (userId,telegramUserId,chatId,displayName) VALUES ('admin','1','1','Alex');
    INSERT INTO TelegramUpdate (id,payload,state) VALUES (1,'{}','DONE');
    INSERT INTO TelegramDelivery (id,key,userId,kind,scheduleDate,state) VALUES ('d1','dk','admin','URGENT','2026-10-21','EMPTY');
    INSERT INTO TelegramButton (id,userId,payload,expiresAt) VALUES ('b1','admin','{}',CURRENT_TIMESTAMP);
    INSERT INTO TelegramWarning (id,userId,productId,fingerprint) VALUES ('w1','admin','p1','f');
    INSERT INTO IntegrationState (id,paused) VALUES ('telegram',0);
    INSERT INTO SharedCatalogEntry (id,barcode,name,createdAt,updatedAt) VALUES
      ('c1','4600000000001','Молоко',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
      ('c2','4600000000002','Хлеб',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO CatalogEntry (id,barcode,name,createdAt,updatedAt,userId) VALUES
      ('ce1','4600000000003','Сыр',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'admin');
    INSERT INTO SystemLog (id,level,message) VALUES ('l1','INFO','started');`);
  db.close();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, source, backupDir: path.join(dir, "backups"), open: () => new Database(source, { readonly: true }) };
}

function run(...args) {
  return spawnSync(process.execPath, ["scripts/purge-departments.mjs", ...args], { cwd: ROOT, encoding: "utf8" });
}

function counts(db) {
  const count = table => db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
  return { users: count("User"), stores: count("Store"), memberships: count("StoreMembership"), products: count("Product"),
    events: count("ProductEvent"), claims: count("ProductClaim"), catalog: count("CatalogEntry"),
    shared: count("SharedCatalogEntry"), settings: count("Settings"), links: count("TelegramLink"),
    updates: count("TelegramUpdate"), deliveries: count("TelegramDelivery"), buttons: count("TelegramButton"),
    warnings: count("TelegramWarning"), logs: count("SystemLog") };
}

test("the purge script reports without deleting, and refuses to delete without the confirmation token", async t => {
  const { source, backupDir, open } = fixture(t);
  const dry = run("--db", source, "--admin", "admin@localhost", "--backup-dir", backupDir);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Dry run/);
  assert.match(dry.stdout, /3 account\(s\)/);
  assert.match(dry.stdout, /Product +2/);
  assert.match(dry.stdout, /SharedCatalogEntry +2/);

  // The snapshot is written before anything is deleted and must reopen clean.
  const snapshots = fs.readdirSync(backupDir).filter(name => name.startsWith("expitrack-pre-purge-"));
  assert.equal(snapshots.length, 1);
  const snapshot = new Database(path.join(backupDir, snapshots[0]), { readonly: true });
  assert.equal(snapshot.pragma("integrity_check", { simple: true }), "ok");
  assert.deepEqual(snapshot.pragma("foreign_key_check"), []);
  assert.equal(snapshot.prepare("SELECT COUNT(*) AS n FROM SharedCatalogEntry").get().n, 2);
  snapshot.close();

  const untouched = open();
  assert.deepEqual(counts(untouched), { users: 4, stores: 1, memberships: 3, products: 2, events: 1, claims: 1,
    catalog: 1, shared: 2, settings: 4, links: 1, updates: 1, deliveries: 1, buttons: 1, warnings: 1, logs: 1 });
  untouched.close();

  const refused = run("--db", source, "--admin", "admin@localhost", "--backup-dir", backupDir, "--apply");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /--confirm PURGE-DEPARTMENTS/);
  const stillThere = open();
  assert.equal(counts(stillThere).users, 4);
  stillThere.close();
});

test("the purge keeps the administrator and the shared catalog, and removes every department row", async t => {
  const { source, backupDir, open } = fixture(t);
  const applied = run("--db", source, "--admin", "admin@localhost", "--backup-dir", backupDir, "--apply", "--confirm", "PURGE-DEPARTMENTS");
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /Purge committed/);

  const db = open();
  const after = counts(db);
  assert.deepEqual(after, { users: 1, stores: 0, memberships: 0, products: 0, events: 0, claims: 0, catalog: 0,
    shared: 2, settings: 1, links: 0, updates: 0, deliveries: 0, buttons: 0, warnings: 0, logs: 2 });
  assert.equal(db.prepare("SELECT email FROM User").get().email, "admin@localhost");
  assert.equal(db.prepare("SELECT userId FROM Settings").get().userId, db.prepare("SELECT id FROM User").get().id);
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  const audit = db.prepare("SELECT level,message,meta FROM SystemLog WHERE level='INFO' AND message LIKE 'Departments purged%'").get();
  assert.ok(audit, "the purge records an audit row");
  assert.equal(JSON.parse(audit.meta).removedAccounts, 3);
  db.close();
});

test("the purge refuses a database that would lose the shared catalog or an unknown administrator", async t => {
  const { source, backupDir, open } = fixture(t);
  const missingAdmin = run("--db", source, "--admin", "nobody@localhost", "--backup-dir", backupDir, "--apply", "--confirm", "PURGE-DEPARTMENTS");
  assert.equal(missingAdmin.status, 1);
  assert.match(missingAdmin.stderr, /exactly one account/);

  const demote = new Database(source);
  demote.exec("UPDATE User SET role='USER' WHERE email='admin@localhost';");
  demote.close();
  const wrongRole = run("--db", source, "--admin", "admin@localhost", "--backup-dir", backupDir, "--apply", "--confirm", "PURGE-DEPARTMENTS");
  assert.equal(wrongRole.status, 1);
  assert.match(wrongRole.stderr, /not ADMIN/);

  const wipe = new Database(source);
  wipe.exec("DELETE FROM SharedCatalogEntry;");
  wipe.close();
  const emptyCatalog = run("--db", source, "--admin", "admin@localhost", "--backup-dir", backupDir, "--apply", "--confirm", "PURGE-DEPARTMENTS");
  assert.equal(emptyCatalog.status, 1);
  assert.match(emptyCatalog.stderr, /shared barcode catalog is empty/);

  const untouched = open();
  assert.equal(counts(untouched).users, 4);
  assert.equal(counts(untouched).stores, 1);
  untouched.close();
});
