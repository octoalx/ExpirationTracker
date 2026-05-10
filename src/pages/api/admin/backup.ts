import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { logger } from "@/lib/logger";

/** GET: export full database backup as a JSON download (admin only). */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    logger.info(`Admin ${session.user.email} exported database backup`, { adminId: session.user.id });

    const [users, products, settings, systemLogs, emailLogs] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      }),
      prisma.product.findMany(),
      prisma.settings.findMany(),
      prisma.systemLog.findMany({ orderBy: { timestamp: "desc" }, take: 1000 }),
      prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    ]);

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: {
        users,
        products,
        settings,
        systemLogs,
        emailLogs,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="expitrack-backup-${new Date().toISOString().split("T")[0]}.json"`);
    res.status(200).json(backup);
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
