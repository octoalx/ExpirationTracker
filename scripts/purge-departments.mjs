#!/usr/bin/env node
/**
 * Operator tool: purge departments and accounts from a production database.
 *
 * After the department access model a store row is one department, and every
 * product belongs to exactly one of them. This script returns a database to the
 * state the owner asked for: the service administrator account and the shared
 * barcode catalog survive, everything else (departments, memberships, products,
 * product history, Telegram queues and the accounts that owned them) is removed.
 *
 * Refuses to run unless every one of the following is true, because none of the
 * checks can be undone with an apology afterwards:
 *   - `--confirm PURGE-DEPARTMENTS` is passed verbatim together with `--apply`;
 *   - the target file is an ExpirationTracker database with a populated
 *     SharedCatalogEntry table (the one asset that must never be lost);
 *   - exactly one account matches `--admin`, and it is an ADMIN;
 *   - a consistent snapshot of the database is written to `--backup-dir` and
 *     reopens clean: integrity_check ok, foreign_key_check empty, row counts equal
 *     to the live database.
 *
 * Without `--apply` the script only reports what it would delete (dry run) and
 * writes nothing. With `--apply` all deletions happen in ONE transaction, the
 * expected state is verified inside it, and any mismatch rolls the transaction
 * back.
 *
 * Usage (inside the app container, script piped over stdin so the audited
 * revision runs without rebuilding the image):
 *   cat scripts/purge-departments.mjs | docker exec -i expirationtracker-app-1 \
 *     node --input-type=module - --db /app/data/dev.db \
 *     --backup-dir /app/backups --admin admin@localhost [--apply --confirm PURGE-DEPARTMENTS]
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const CONFIRMATION = "PURGE-DEPARTMENTS";

/**
 * Deletion order follows the foreign keys: claims and Telegram queues first, then
 * products, then memberships, then departments, then the accounts that owned them.
 * CatalogEntry is personal data of an account, so it leaves with its owner.
 */
const PURGED_TABLES = [
  "ProductClaim",
  "TelegramWarning",
  "TelegramDelivery",
  "TelegramButton",
  "TelegramUpdate",
  "TelegramLinkRequest",
  "TelegramLink",
  "ProductEvent",
  "Product",
  "StoreMembership",
  "Store",
  "CatalogEntry",
];

/** Tables whose row counts are compared before and after the purge. */
const PRESERVED_TABLES = ["SharedCatalogEntry", "SystemLog", "EmailLog", "IntegrationState"];

const USAGE = `Purge departments and non-administrator accounts (see the file header).

  --db <path>          database file to inspect (required)
  --admin <email>      the single account to keep (required)
  --backup-dir <path>  where the verified pre-purge snapshot is written (required)
  --apply              actually delete; without it this is a dry run
  --confirm <token>    required with --apply: ${CONFIRMATION}`;

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { db: null, admin: null, backupDir: null, apply: false, confirm: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--db") options.db = argv[++index];
    else if (arg === "--admin") options.admin = argv[++index];
    else if (arg === "--backup-dir") options.backupDir = argv[++index];
    else if (arg === "--confirm") options.confirm = argv[++index];
    else if (arg === "--help" || arg === "-h") { console.log(USAGE); process.exit(0); }
    else fail(`unknown argument "${arg}"\n\n${USAGE}`);
  }
  if (!options.db || !options.admin || !options.backupDir) fail(`missing argument\n\n${USAGE}`);
  if (options.apply && options.confirm !== CONFIRMATION) {
    fail(`--apply needs --confirm ${CONFIRMATION} (the token is spelled out on purpose)`);
  }
  if (!options.apply && options.confirm) fail("--confirm without --apply would be misleading; drop it");
  return options;
}

function tableCount(db, table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
}

/** Row counts of every table the purge touches or must leave alone. */
function readCounts(db, extraTables = []) {
  const names = [...PURGED_TABLES, ...PRESERVED_TABLES, "User", "Settings", "Account", "Session", ...extraTables];
  return Object.fromEntries(names.map(name => [name, tableCount(db, name)]));
}

function inventory(db, adminEmail) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
  for (const required of ["User", "Product", "SharedCatalogEntry"]) {
    if (!tables.has(required)) fail(`not an ExpirationTracker database: no ${required} table`);
  }
  if (tableCount(db, "SharedCatalogEntry") === 0) fail("the shared barcode catalog is empty: refusing to touch this database");

  const admin = db.prepare("SELECT id,name,email,role FROM User WHERE email = ?").all(adminEmail);
  if (admin.length !== 1) fail(`expected exactly one account with email ${adminEmail}, found ${admin.length}`);
  if (admin[0].role !== "ADMIN") fail(`${adminEmail} is ${admin[0].role}, not ADMIN: refusing to purge`);
  const keep = admin[0];
  const doomed = db.prepare("SELECT id,name,email,role FROM User WHERE id <> ? ORDER BY email").all(keep.id);
  const departments = db.prepare("SELECT id,name FROM Store ORDER BY id").all();
  const memberships = db.prepare(`SELECT StoreMembership.role AS role, User.email AS email, Store.name AS department
    FROM StoreMembership JOIN User ON User.id = StoreMembership.userId
    JOIN Store ON Store.id = StoreMembership.storeId ORDER BY User.email`).all();
  const personal = db.prepare('SELECT COUNT(*) AS n FROM Product WHERE storeId IS NULL').get().n;
  const telegramLinks = db.prepare("SELECT userId,displayName FROM TelegramLink").all();
  const before = readCounts(db, ["CatalogEntry", "TelegramWarning", "TelegramLinkRequest", "ProductClaim"]);
  // Settings rows leave with their account through the cascade, so the expected
  // survivor count is a subtraction rather than a constant.
  const settingsRemoved = doomed.length
    ? db.prepare(`SELECT COUNT(*) AS n FROM Settings WHERE userId IN (${doomed.map(() => "?").join(",")})`).get(...doomed.map(user => user.id)).n
    : 0;
  return { keep, doomed, departments, memberships, personal, telegramLinks, before, settingsRemoved };
}

function printInventory({ keep, doomed, departments, memberships, personal, telegramLinks, before }) {
  console.log("=== Database inventory ===");
  console.log(`  keep           : ${keep.email} (${keep.role}, ${keep.name ?? "no name"})`);
  console.log(`  delete         : ${doomed.length} account(s)`);
  for (const user of doomed) console.log(`      - ${user.email} (${user.role}, ${user.name ?? "no name"})`);
  console.log(`  departments    : ${departments.length}`);
  for (const department of departments) console.log(`      - ${department.id} "${department.name}"`);
  console.log(`  memberships    : ${memberships.length}`);
  for (const member of memberships) console.log(`      - ${member.email} = ${member.role} of "${member.department}"`);
  console.log(`  products without a department: ${personal}`);
  console.log(`  telegram links : ${telegramLinks.length}`);
  for (const link of telegramLinks) console.log(`      - ${link.userId} "${link.displayName}"`);
  console.log("=== Rows to delete ===");
  for (const table of PURGED_TABLES) console.log(`  ${table.padEnd(20)} ${before[table]}`);
  console.log(`  ${"User".padEnd(20)} ${doomed.length} (of ${before.User})`);
  console.log("=== Rows to preserve ===");
  for (const table of PRESERVED_TABLES) console.log(`  ${table.padEnd(20)} ${before[table]}`);
  console.log(`  ${"Settings".padEnd(20)} ${before.Settings} (only the kept account survives the cascade)`);
}

/**
 * A snapshot that cannot be reopened is not a backup, and a backup taken from a
 * live WAL database is worthless unless it goes through SQLite's own copy, which
 * reads a consistent transaction and carries the WAL contents with it.
 */
async function writeSnapshot(db, backupDir, before) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const name = `expitrack-pre-purge-${stamp}.db`;
  const target = path.join(backupDir, name);
  if (fs.existsSync(target)) fail(`snapshot ${target} already exists`);
  await db.backup(target);
  const size = fs.statSync(target).size;
  console.log(`=== Snapshot ===`);
  console.log(`  file           : ${target}`);
  console.log(`  size           : ${size} bytes`);

  const copy = new Database(target, { readonly: true, fileMustExist: true });
  try {
    const integrity = copy.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") fail(`snapshot integrity_check returned "${integrity}"`);
    const violations = copy.pragma("foreign_key_check");
    if (violations.length) fail(`snapshot foreign_key_check reported ${violations.length} violation(s)`);
    for (const table of ["User", "Store", "StoreMembership", "Product", "ProductEvent", "SharedCatalogEntry", "SystemLog"]) {
      const expected = before[table];
      const actual = tableCount(copy, table);
      if (actual !== expected) fail(`snapshot ${table} holds ${actual} rows, live database holds ${expected}`);
    }
    console.log(`  verified       : integrity_check ok, foreign_key_check empty, row counts match the live database`);
  } finally {
    copy.close();
  }
  return target;
}

/** All deletions in one transaction, verified before it is allowed to commit. */
function purge(db, { keep, plannedAccounts, preserved, settingsRemoved, snapshot, adminEmail }) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of PURGED_TABLES) db.prepare(`DELETE FROM "${table}"`).run();
    const removed = db.prepare("DELETE FROM User WHERE id <> ?").run(keep.id).changes;
    if (removed !== plannedAccounts) {
      throw new Error(`accounts changed while the purge was prepared: planned ${plannedAccounts}, found ${removed}`);
    }

    const after = readCounts(db);
    const problems = [];
    for (const table of PURGED_TABLES) if (after[table] !== 0) problems.push(`${table} still holds ${after[table]} row(s)`);
    if (after.User !== 1) problems.push(`User holds ${after.User} row(s), expected 1`);
    if (after.Settings !== preserved.Settings - settingsRemoved) {
      problems.push(`Settings holds ${after.Settings} row(s), expected ${preserved.Settings - settingsRemoved}`);
    }
    for (const table of PRESERVED_TABLES) {
      if (after[table] !== preserved[table]) problems.push(`${table} changed from ${preserved[table]} to ${after[table]}`);
    }
    const orphanSettings = db.prepare("SELECT COUNT(*) AS n FROM Settings WHERE userId <> ?").get(keep.id).n;
    if (orphanSettings) problems.push(`${orphanSettings} Settings row(s) survived their account`);
    const violations = db.pragma("foreign_key_check");
    if (violations.length) problems.push(`foreign_key_check reported ${violations.length} violation(s)`);
    if (problems.length) throw new Error(problems.join("; "));

    db.prepare("INSERT INTO SystemLog (id,timestamp,level,message,meta) VALUES (?,CURRENT_TIMESTAMP,'INFO',?,?)").run(
      randomUUID(),
      "Departments purged by scripts/purge-departments.mjs",
      JSON.stringify({ adminEmail, keptAccount: keep.id, removedAccounts: removed, snapshot: path.basename(snapshot) }),
    );
    db.exec("COMMIT");
    return after;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = new Database(options.db, { fileMustExist: true });
  db.pragma("busy_timeout = 30000");
  try {
    const state = inventory(db, options.admin);
    printInventory(state);

    const snapshot = await writeSnapshot(db, options.backupDir, state.before);

    if (!options.apply) {
      console.log("=== Dry run ===");
      console.log("  nothing was deleted; re-run with --apply --confirm " + CONFIRMATION + " to purge");
      return;
    }

    const after = purge(db, {
      keep: state.keep,
      plannedAccounts: state.doomed.length,
      preserved: state.before,
      settingsRemoved: state.settingsRemoved,
      snapshot,
      adminEmail: options.admin,
    });
    console.log("=== Purge committed ===");
    console.log(`  User ${after.User}, Store ${after.Store}, StoreMembership ${after.StoreMembership}, Product ${after.Product}, ProductEvent ${after.ProductEvent}`);
    console.log(`  SharedCatalogEntry ${after.SharedCatalogEntry} (unchanged), SystemLog ${after.SystemLog} (audit row added)`);
    console.log(`  rollback source: ${snapshot}`);
  } finally {
    db.close();
  }
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
