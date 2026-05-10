import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBackupFilePath, listBackups } from "@/lib/backupService";
import fs from "fs";
import path from "path";
import { resolvePrismaDbPath } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

/** GET: download backup | POST: restore from backup | DELETE: remove backup (admin only). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { filename } = req.query;
  if (typeof filename !== "string") {
    return res.status(400).json({ message: "Invalid filename" });
  }

  // Validate filename exists in the backup list (prevents path traversal)
  const backups = listBackups();
  const backup = backups.find((b) => b.name === filename);
  if (!backup) {
    return res.status(404).json({ message: "Backup not found" });
  }

  if (req.method === "GET") {
    const filePath = getBackupFilePath(filename);
    if (!filePath) {
      return res.status(404).json({ message: "File not found" });
    }

    const stat = fs.statSync(filePath);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    return;
  }

  if (req.method === "POST") {
    const { mode = "replace" } = req.body as { mode?: "merge" | "replace" };

    const backupPath = getBackupFilePath(filename);
    if (!backupPath) {
      return res.status(404).json({ message: "Backup file not found" });
    }

    try {
      const dbPath = resolvePrismaDbPath();

      // Create emergency backup before overwriting the database
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const emergencyBackup = path.join(path.dirname(dbPath), `emergency-pre-restore-${timestamp}.db`);
      fs.copyFileSync(dbPath, emergencyBackup);

      fs.copyFileSync(backupPath, dbPath);

      await prisma.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} restored database from backup`,
          meta: JSON.stringify({
            adminId: session.user.id,
            backupFile: filename,
            mode,
            emergencyBackup,
          }),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Database restored successfully",
        emergencyBackup: path.basename(emergencyBackup),
      });
    } catch (error) {
      console.error("[Restore] Error:", error);
      return res.status(500).json({
        message: "Restore failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (req.method === "DELETE") {
    const backupPath = getBackupFilePath(filename);
    if (!backupPath) {
      return res.status(404).json({ message: "Backup file not found" });
    }

    try {
      fs.unlinkSync(backupPath);
      console.log(`[Backup] Deleted: ${filename}`);

      await prisma.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} deleted backup`,
          meta: JSON.stringify({
            adminId: session.user.id,
            backupFile: filename,
          }),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Backup deleted successfully",
      });
    } catch (error) {
      console.error("[Backup] Delete error:", error);
      return res.status(500).json({
        message: "Delete failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
