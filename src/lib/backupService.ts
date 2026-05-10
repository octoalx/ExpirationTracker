import fs from "fs";
import path from "path";
import { resolvePrismaDbPath } from "./prisma";
import { logger } from "./logger";

/** Directory where database backups are stored. */
const BACKUP_DIR = path.join(process.cwd(), "backups");

/** Maximum number of backup files to retain. */
const MAX_BACKUPS = 30;

/** Creates the backup directory if it does not exist. */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/** Returns an ISO-based timestamp string safe for filenames. */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/** Returns the absolute path to the backup directory. */
export function getBackupPath(): string {
  return BACKUP_DIR;
}

/**
 * Creates a backup of the SQLite database file.
 * Automatically cleans up old backups exceeding {@link MAX_BACKUPS}.
 *
 * @returns The backup filename on success, or `null` on failure.
 */
export function createBackup(): string | null {
  try {
    ensureBackupDir();
    const dbPath = resolvePrismaDbPath();
    const timestamp = getTimestamp();
    const backupName = `expitrack-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(dbPath, backupPath);
    cleanupOldBackups();

    console.log(`[Backup] Created: ${backupName}`);
    return backupName;
  } catch (err) {
    logger.error("[Backup] Error creating backup", { error: String(err) });
    return null;
  }
}

/** Removes the oldest backup files when total count exceeds {@link MAX_BACKUPS}. */
export function cleanupOldBackups(): void {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("expitrack-backup-") && f.endsWith(".db"))
      .map((f) => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Deleted old: ${file.name}`);
      }
    }
  } catch (err) {
    logger.error("[Backup] Error cleaning up old backups", { error: String(err) });
  }
}

/** Lists all backup files sorted by creation date (newest first). */
export function listBackups(): Array<{
  name: string;
  size: number;
  createdAt: string;
  path: string;
}> {
  try {
    ensureBackupDir();
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("expitrack-backup-") && f.endsWith(".db"))
      .map((f) => {
        const filePath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(filePath);
        return {
          name: f,
          size: stat.size,
          createdAt: new Date(stat.mtime).toISOString(),
          path: filePath,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Resolves and validates a backup file path.
 * Prevents path traversal by verifying the resolved path stays within the backup directory.
 *
 * @param filename - Backup filename to resolve.
 * @returns Absolute file path, or `null` if invalid or not found.
 */
export function getBackupFilePath(filename: string): string | null {
  const filePath = path.join(BACKUP_DIR, filename);
  const resolvedPath = path.resolve(filePath);
  const resolvedBackupDir = path.resolve(BACKUP_DIR);
  if (!resolvedPath.startsWith(resolvedBackupDir)) {
    return null;
  }
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return filePath;
}
