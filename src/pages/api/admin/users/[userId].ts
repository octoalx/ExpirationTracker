import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { logger } from "@/lib/logger";
import { InventoryError } from "@/lib/server/inventory";
import { apiFailure } from "@/lib/server/api";

/** DELETE: remove a user | PUT: change a user's role (admin only). */
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
      await prisma.$transaction(async tx => {
        const member = await tx.storeMembership.findUnique({ where: { userId: String(userId) } });
        if (member?.role === "MANAGER" && await tx.storeMembership.count({ where: { storeId: member.storeId, role: "MANAGER" } }) <= 1) throw new InventoryError(409, "Сначала назначьте другого руководителя через администратора.");
        await tx.product.deleteMany({ where: { userId: String(userId), storeId: null } });
        await tx.productClaim.deleteMany({ where: { userId: String(userId) } });
        await tx.telegramButton.deleteMany({ where: { userId: String(userId) } });
        await tx.telegramWarning.deleteMany({ where: { userId: String(userId) } });
        await tx.telegramDelivery.updateMany({ where: { userId: String(userId), state: { in: ["QUEUED", "PROCESSING"] } }, data: { state: "CANCELLED" } });
        await tx.user.delete({ where: { id: String(userId) } });
      });
      logger.info(`Admin ${session.user.email} deleted user ${user?.email || userId}`, {
        adminId: session.user.id, userId, userEmail: user?.email,
      });
      res.status(204).end();
    } catch (error) {
      apiFailure(res, error);
    }
  } else if (req.method === "PUT") {
    const { role } = req.body;
    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId as string },
        data: { role },
        select: { id: true, name: true, email: true, role: true },
      });
      logger.info(`Admin ${session.user.email} changed role of ${updatedUser.email} to ${role}`, {
        adminId: session.user.id, userId, newRole: role, userEmail: updatedUser.email,
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
