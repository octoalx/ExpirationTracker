import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

/** GET: list all system log entries ordered by timestamp (admin only). */
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
    const logs = await prisma.systemLog.findMany({
      orderBy: {
        timestamp: "desc",
      },
    });
    res.status(200).json(logs);
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
