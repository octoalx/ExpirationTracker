import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

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
    const { level, page = "1", limit = "50" } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = level ? { level: level as string } : {};

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.systemLog.count({ where }),
    ]);

    res.status(200).json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
