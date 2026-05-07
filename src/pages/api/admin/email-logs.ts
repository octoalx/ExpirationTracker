import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method === "GET") {
    try {
      const { status, page = "1", limit = "50" } = req.query;
      
      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
      const skip = (pageNum - 1) * limitNum;

      const where = status ? { status: status as string } : {};

      const [logs, total] = await Promise.all([
        prisma.emailLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.emailLog.count({ where }),
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
  } else if (req.method === "POST") {
    // Retry failed email - update status to QUEUED
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ message: "Email log ID required" });
      }

      const emailLog = await prisma.emailLog.findUnique({ where: { id } });

      const updated = await prisma.emailLog.update({
        where: { id },
        data: {
          status: "QUEUED",
          retryCount: { increment: 1 },
        },
      });

      await prisma.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} retried email to ${emailLog?.to}`,
          meta: JSON.stringify({ adminId: session.user.id, emailLogId: id, to: emailLog?.to }),
        },
      });

      res.status(200).json(updated);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
