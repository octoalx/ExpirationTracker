import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

/**
 * GET: service counters for the administrator dashboard.
 * The administrator sees accounts and departments, never product rows, so this
 * endpoint deliberately does not read the product table.
 */
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
    const [totalUsers, departments, assignedAccounts, totalIssues] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.storeMembership.count(),
      prisma.systemLog.count(),
    ]);

    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json({
      totalUsers,
      departments,
      accountsWithoutDepartment: totalUsers - assignedAccounts,
      totalIssues,
    });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
