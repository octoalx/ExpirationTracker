import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { inventoryScope, requireManager, InventoryError } from "@/lib/server/inventory";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, no-store");
      const { membership } = await inventoryScope(prisma, user.id);
      return res.json({ store: membership?.store ?? null, role: membership?.role ?? null,
        members: membership ? await prisma.storeMembership.findMany({ where: { storeId: membership.storeId },
          select: { userId: true, role: true, user: { select: { name: true, email: true } } } }) : [] });
    }
    if (!["POST", "DELETE"].includes(req.method ?? "")) return res.status(405).end();
    await prisma.$transaction(async tx => {
      const manager = await requireManager(tx, user.id);
      if (req.method === "POST") {
        const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
        const target = await tx.user.findUnique({ where: { email } });
        if (!target) throw new InventoryError(404, "Аккаунт не найден. Сначала создайте личный аккаунт.");
        if (await tx.storeMembership.findUnique({ where: { userId: target.id } })) throw new InventoryError(409, "Сотрудник уже в команде.");
        if (await tx.product.count({ where: { userId: target.id, storeId: null } })) throw new InventoryError(409, "У аккаунта есть личные товары. Администратор должен выполнить явный перенос.");
        await tx.storeMembership.create({ data: { storeId: manager.storeId, userId: target.id, role: "EMPLOYEE" } });
      } else {
        const target = await tx.storeMembership.findUnique({ where: { userId: String(req.body?.userId ?? "") } });
        if (!target || target.storeId !== manager.storeId) throw new InventoryError(404, "Сотрудник не найден.");
        if (target.role === "MANAGER") throw new InventoryError(409, "Руководителя нельзя исключить из команды.");
        await tx.storeMembership.delete({ where: { userId: target.userId } });
        await tx.productClaim.deleteMany({ where: { userId: target.userId } });
        await tx.telegramButton.deleteMany({ where: { userId: target.userId } });
        await tx.telegramDelivery.updateMany({ where: { userId: target.userId, state: "QUEUED" }, data: { state: "CANCELLED" } });
      }
    });
    return res.json({ success: true });
  } catch (error) { return apiFailure(res, error); }
}
