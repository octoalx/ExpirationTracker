import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * SQLite startup health: WAL enforcement and rollback-journal quarantine.
 *
 * Why this exists. SQLite in rollback-journal mode (`journal_mode=delete`, the
 * default) writes `<db>-journal` next to the database while a write transaction
 * is open. If the process is killed mid-transaction - a container recreation
 * during a deploy, an OOM kill, a host reboot - that file can be left behind.
 * SQLite treats a leftover journal as a transaction to roll back, and if the
 * file's header is not a valid journal header it cannot finish recovery: every
 * subsequent statement fails or blocks until it times out.
 *
 * That is not hypothetical. On 2026-10-13 a deploy recreated the app container
 * while the scheduled 03:00 backup was running; the result was a `dev.db-journal`
 * with a zeroed header and a login endpoint failing with Prisma P1008
 * (SocketTimeout). The database was intact the whole time - only the leftover
 * journal was broken, but in delete mode it wedged every read.
 *
 * WAL removes the failure mode: WAL readers never block a writer, readers never
 * block each other, and recovery is automatic. WAL is a persistent database
 * property, but external tooling (or a fresh file copied in) can reset it, so
 * {@link ensureWalMode} re-asserts it on every startup. The journal guard is the
 * belt to WAL's braces: it detects a journal that can never be valid and moves
 * it aside instead of letting the application wedge.
 */

/** A valid rollback journal starts with this 8-byte magic number (big-endian). */
const JOURNAL_MAGIC = Buffer.from([0xd9, 0xd5, 0x05, 0xf9, 0x20, 0xa1, 0x63, 0xd7]);

/** Journal header is 28 bytes; anything shorter than this cannot be valid. */
const JOURNAL_HEADER_SIZE = 28;

/** Fallback quarantine directory when the caller does not supply one. */
export function defaultQuarantineDir(): string {
  return path.join(process.cwd(), "backups", "journal-quarantine");
}

/** Report produced by {@link inspectJournal}. */
export type JournalInspection = {
  path: string;
  exists: boolean;
  size: number;
  valid: boolean;
  reason: string;
};

/**
 * Classifies the rollback journal for `dbPath` without modifying it.
 *
 * A journal is treated as invalid only when it cannot possibly be genuine:
 * truncated below the header size, or its magic number does not match. A
 * well-formed journal (even one holding a real, uncommitted transaction) is
 * reported valid, because SQLite must be allowed to roll it back itself -
 * discarding it would lose the rollback data and can corrupt the database.
 */
export function inspectJournal(dbPath: string): JournalInspection {
  const journalPath = `${dbPath}-journal`;
  if (!fs.existsSync(journalPath)) {
    return { path: journalPath, exists: false, size: 0, valid: true, reason: "no journal file" };
  }

  const size = fs.statSync(journalPath).size;
  if (size === 0) {
    // A zero-length journal carries no header and no data; SQLite ignores it.
    return { path: journalPath, exists: true, size, valid: true, reason: "empty journal" };
  }
  if (size < JOURNAL_HEADER_SIZE) {
    return { path: journalPath, exists: true, size, valid: false, reason: "shorter than a journal header" };
  }

  const fd = fs.openSync(journalPath, "r");
  try {
    const header = Buffer.alloc(JOURNAL_HEADER_SIZE);
    fs.readSync(fd, header, 0, JOURNAL_HEADER_SIZE, 0);
    if (!header.subarray(0, 8).equals(JOURNAL_MAGIC)) {
      return {
        path: journalPath,
        exists: true,
        size,
        valid: false,
        reason: `magic number ${header.subarray(0, 8).toString("hex")} is not a journal header`,
      };
    }
    return { path: journalPath, exists: true, size, valid: true, reason: "valid journal header" };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Moves an unusable journal out of the way so the database can be opened.
 *
 * Returns the quarantine path, or null when no action was needed. The file is
 * moved, never deleted, so its original bytes stay available for inspection.
 */
export function quarantineInvalidJournal(dbPath: string, quarantineDir = defaultQuarantineDir()): string | null {
  const inspection = inspectJournal(dbPath);
  if (!inspection.exists || inspection.valid) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(quarantineDir, `${path.basename(inspection.path)}.${stamp}`);
  try {
    fs.mkdirSync(quarantineDir, { recursive: true });
    fs.renameSync(inspection.path, target);
    return target;
  } catch {
    // A cross-device rename (data/ and backups/ on different mounts) fails, and the
    // quarantine directory itself may not be writable. Fall back to a directory
    // beside the database, which is always writable when the database is, so the
    // guard still succeeds; copy then remove because the move cannot be atomic.
    const localDir = path.join(path.dirname(dbPath), ".journal-quarantine");
    const localTarget = path.join(localDir, `${path.basename(inspection.path)}.${stamp}`);
    fs.mkdirSync(localDir, { recursive: true });
    fs.copyFileSync(inspection.path, localTarget);
    fs.unlinkSync(inspection.path);
    return localTarget;
  }
}

/**
 * Forces `journal_mode=WAL` on the database file and returns the applied mode.
 *
 * Opening the file with better-sqlite3 creates it when absent (matching Prisma,
 * which would otherwise create it on first use) so the mode is set before any
 * migration runs. `journal_mode` is persistent, so this is idempotent and cheap
 * on an already-WAL database.
 */
export function ensureWalMode(dbPath: string): string {
  const db = new Database(dbPath);
  try {
    const mode = db.pragma("journal_mode = WAL", { simple: true }) as string;
    // FULL is overkill for this workload; NORMAL pairs safely with WAL and keeps
    // a synchronised WAL across process crashes.
    db.pragma("synchronous = NORMAL");
    return mode;
  } finally {
    db.close();
  }
}

/** Outcome of {@link prepareDatabaseForStartup}. */
export type StartupDatabaseHealth = {
  journal: JournalInspection;
  quarantinedTo: string | null;
  journalMode: string | null;
};

/**
 * Makes the database openable at startup: quarantines an unusable journal and
 * forces WAL, then reports what happened so the caller can log it.
 *
 * Never deletes database data and never touches a valid journal. WAL failures
 * are reported as a null `journalMode` rather than thrown, because a missing
 * better-sqlite3 binary should not stop the entrypoint from explaining why.
 */
export function prepareDatabaseForStartup(
  dbPath: string,
  quarantineDir = defaultQuarantineDir(),
): StartupDatabaseHealth {
  const journal = inspectJournal(dbPath);

  let quarantinedTo: string | null = null;
  if (journal.exists && !journal.valid) {
    quarantinedTo = quarantineInvalidJournal(dbPath, quarantineDir);
  }

  let journalMode: string | null = null;
  try {
    journalMode = ensureWalMode(dbPath);
  } catch {
    journalMode = null;
  }

  return { journal, quarantinedTo, journalMode };
}
