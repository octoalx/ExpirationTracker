import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

/** GET: admin dashboard KPIs (total users, active/expired products, issues). */
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
    const totalUsers = await prisma.user.count();
    const activeProducts = await prisma.product.count({
      where: { status: "ACTIVE" },
    });
    const expiredProducts = await prisma.product.count({
      where: {
        expiryDate: { lte: new Date() },
        status: "ACTIVE",
      },
    });
    const totalIssues = await prisma.systemLog.count();

    res.status(200).json({
      totalUsers,
      activeProducts,
      expiredProducts,
      totalIssues,
    });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
