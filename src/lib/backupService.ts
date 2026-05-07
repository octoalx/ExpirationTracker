import fs from "fs";
import path from "path";
import { resolvePrismaDbPath } from "./prisma";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function getBackupPath(): string {
  return BACKUP_DIR;
}

export function createBackup(): string | null {
  try {
    ensureBackupDir();
    const dbPath = resolvePrismaDbPath();
    const timestamp = getTimestamp();
    const backupName = `expitrack-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    // Copy DB file
    fs.copyFileSync(dbPath, backupPath);

    // Clean old backups (keep only MAX_BACKUPS newest)
    cleanupOldBackups();

    console.log(`[Backup] Created: ${backupName}`);
    return backupName;
  } catch (err) {
    console.error("[Backup] Error creating backup:", err);
    return null;
  }
}

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
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[Backup] Deleted old: ${file.name}`);
      }
    }
  } catch (err) {
    console.error("[Backup] Error cleaning up old backups:", err);
  }
}

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

export function getBackupFilePath(filename: string): string | null {
  const filePath = path.join(BACKUP_DIR, filename);
  // Security: ensure file is inside backup dir
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
