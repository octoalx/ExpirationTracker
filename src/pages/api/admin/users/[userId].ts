import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { userId } = req.query;
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.method === "DELETE") {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId as string } });
      await prisma.user.delete({
        where: { id: userId as string },
      });
      await prisma.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} deleted user ${user?.email || userId}`,
          meta: JSON.stringify({ adminId: session.user.id, userId, userEmail: user?.email }),
        },
      });
      res.status(204).end();
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "PUT") {
    const { role } = req.body;
    if (!["USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId as string },
        data: { role },
      });
      await prisma.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} changed role of ${updatedUser.email} to ${role}`,
          meta: JSON.stringify({ adminId: session.user.id, userId, newRole: role, userEmail: updatedUser.email }),
        },
      });
      res.status(200).json(updatedUser);
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["DELETE", "PUT"]);
    res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
}
