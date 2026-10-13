import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { inspectJournal, quarantineInvalidJournal, ensureWalMode, prepareDatabaseForStartup } from "../src/lib/server/sqlite-health";
import { copySqliteSnapshot } from "../src/lib/server/sqlite-snapshot";

/** A valid rollback-journal magic number (big-endian). */
const VALID_MAGIC = Buffer.from([0xd9, 0xd5, 0x05, 0xf9, 0x20, 0xa1, 0x63, 0xd7]);

/** Builds a disposable directory containing a real, empty SQLite database. */
function disposable(t: test.TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expitrack-db-robustness-"));
  t.after(() => {
    const resolved = path.resolve(dir);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("expitrack-db-robustness-")) {
      throw new Error("Unexpected test storage");
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const dbPath = path.join(dir, "dev.db");
  const db = new Database(dbPath);
  db.exec("CREATE TABLE Probe(id TEXT PRIMARY KEY, value TEXT); INSERT INTO Probe(id, value) VALUES ('row', 'intact');");
  db.close();
  return { dir, dbPath, journalPath: `${dbPath}-journal` };
}

test("invalid-journal detection: a zeroed header is rejected, a real header is accepted", async (t) => {
  const { dbPath, journalPath } = disposable(t);

  // The 2026-10-13 incident signature: a journal whose header is all zeroes.
  const broken = Buffer.alloc(8720);
  fs.writeFileSync(journalPath, broken);
  const invalid = inspectJournal(dbPath);
  assert.equal(invalid.exists, true);
  assert.equal(invalid.valid, false, "a zeroed header is not a journal header");
  assert.match(invalid.reason, /magic number 0000000000000000/);

  // A genuine header must be accepted so SQLite can roll it back itself.
  fs.writeFileSync(journalPath, Buffer.concat([VALID_MAGIC, Buffer.alloc(64, 0x41)]));
  assert.equal(inspectJournal(dbPath).valid, true);
  assert.equal(inspectJournal(dbPath).reason, "valid journal header");

  // Truncated below a header is unusable; an empty journal is harmless.
  fs.writeFileSync(journalPath, Buffer.from([0xd9, 0xd5, 0x05]));
  assert.equal(inspectJournal(dbPath).valid, false);
  fs.writeFileSync(journalPath, Buffer.alloc(0));
  assert.equal(inspectJournal(dbPath).valid, true);
  assert.equal(inspectJournal(dbPath).reason, "empty journal");
});

test("a valid journal is never touched, a corrupt journal is quarantined (not deleted)", async (t) => {
  const { dbPath, journalPath, dir } = disposable(t);
  const quarantineDir = path.join(dir, "journal-quarantine");

  // Valid journal: the quarantine guard must leave it exactly where it is. This is
  // the "do not touch a real journal" guarantee - SQLite itself is later allowed to
  // roll it back when it opens the database, which is recovery, not interference.
  const valid = Buffer.concat([VALID_MAGIC, Buffer.alloc(64, 0x42)]);
  fs.writeFileSync(journalPath, valid);
  assert.equal(inspectJournal(dbPath).valid, true);
  assert.equal(quarantineInvalidJournal(dbPath, quarantineDir), null, "a valid journal must never be moved aside");
  assert.equal(fs.existsSync(journalPath), true, "the valid journal must still be present");
  assert.deepEqual(fs.readFileSync(journalPath), valid, "the valid journal bytes must be unchanged");
  assert.equal(fs.existsSync(quarantineDir), false, "nothing to quarantine means no directory");

  // The startup report agrees: no quarantine for a valid journal.
  assert.equal(prepareDatabaseForStartup(dbPath, quarantineDir).quarantinedTo, null);

  // Corrupt journal: moved into quarantine, original bytes preserved, database intact.
  const corrupt = Buffer.alloc(4096);
  fs.writeFileSync(journalPath, corrupt);
  const quarantined = prepareDatabaseForStartup(dbPath, quarantineDir);
  assert.notEqual(quarantined.quarantinedTo, null, "the corrupt journal must be moved aside");
  assert.equal(fs.existsSync(journalPath), false, "the corrupt journal must not remain in place");
  const kept = fs.readdirSync(quarantineDir);
  assert.equal(kept.length, 1, "exactly one quarantined file");
  assert.deepEqual(fs.readFileSync(path.join(quarantineDir, kept[0])), corrupt, "quarantined bytes must match the original");
  const check = new Database(dbPath, { readonly: true });
  assert.equal((check.prepare("SELECT value FROM Probe WHERE id='row'").get() as { value: string }).value, "intact");
  check.close();
});

test("no journal at all leaves startup untouched and never creates a quarantine directory", async (t) => {
  const { dbPath, dir } = disposable(t);
  const quarantineDir = path.join(dir, "journal-quarantine");
  const result = prepareDatabaseForStartup(dbPath, quarantineDir);
  assert.equal(result.journal.exists, false);
  assert.equal(result.quarantinedTo, null);
  assert.equal(fs.existsSync(quarantineDir), false, "no quarantine directory when there is nothing to quarantine");
  assert.equal(fs.existsSync(`${dbPath}-journal`), false);
});

test("WAL is enforced on a delete-mode database and is idempotent", async (t) => {
  const { dbPath } = disposable(t);

  // Prove the starting point really is delete mode, not WAL.
  const before = new Database(dbPath);
  assert.equal(String(before.pragma("journal_mode", { simple: true })).toLowerCase(), "delete");
  before.close();

  assert.equal(ensureWalMode(dbPath).toLowerCase(), "wal");
  const applied = new Database(dbPath);
  assert.equal(String(applied.pragma("journal_mode", { simple: true })).toLowerCase(), "wal");
  // NORMAL is the safe companion of WAL for crash durability.
  assert.equal(applied.pragma("synchronous", { simple: true }), 1);
  applied.close();

  // A second call on an already-WAL database must not fail or change the mode.
  assert.equal(ensureWalMode(dbPath).toLowerCase(), "wal");

  // The startup path applies the same setting.
  const health = prepareDatabaseForStartup(dbPath, path.join(path.dirname(dbPath), "q"));
  assert.equal(String(health.journalMode).toLowerCase(), "wal");
});

test("snapshot writes only a complete file: a failed backup leaves no partial or junk file", async (t) => {
  const { dir, dbPath } = disposable(t);
  const backupDir = path.join(dir, "backups");
  fs.mkdirSync(backupDir);
  const backupPath = path.join(backupDir, "expitrack-backup-test.db");
  const tempPath = `${backupPath}.partial`;

  // Successful snapshot produces a complete, openable database and no temp file.
  await copySqliteSnapshot(dbPath, tempPath);
  fs.renameSync(tempPath, backupPath);
  assert.equal(fs.existsSync(tempPath), false, "the temp snapshot must be renamed away, not left behind");
  const restored = new Database(backupPath, { readonly: true });
  assert.equal((restored.prepare("SELECT value FROM Probe WHERE id='row'").get() as { value: string }).value, "intact");
  restored.close();

  // A failed snapshot (source missing) must not create a usable-looking file.
  const missing = path.join(dir, "does-not-exist.db");
  const failedPath = path.join(backupDir, "expitrack-backup-failed.db");
  await assert.rejects(copySqliteSnapshot(missing, `${failedPath}.partial`));
  assert.equal(fs.existsSync(failedPath), false, "a failed snapshot must not yield a final backup file");
  assert.equal(fs.existsSync(`${failedPath}.partial`), false, "a failed snapshot must not leave a partial file");
});
