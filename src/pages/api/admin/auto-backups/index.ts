import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listBackups, createBackup } from "@/lib/backupService";
import { prisma } from "@/lib/prisma";

/** GET: list auto-backups | POST: manually trigger a new backup (admin only). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method === "GET") {
    const backups = listBackups();
    return res.status(200).json({ backups });
  }

  if (req.method === "POST") {
    const filename = await createBackup();
    if (filename) {
      await prisma.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} created manual backup`,
          meta: JSON.stringify({ adminId: session.user.id, filename }),
        },
      });
      return res.status(200).json({ success: true, filename });
    }
    return res.status(500).json({ message: "Backup failed" });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
