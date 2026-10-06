import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { inventoryScope, requireManager, InventoryError } from "@/lib/server/inventory";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method === "GET") {
      const { membership } = await inventoryScope(prisma, user.id);
      return res.json({ store: membership?.store ?? null });
    }
    if (req.method !== "POST") return res.status(405).end();
    const { urgentThreshold, warningThreshold } = req.body ?? {};
    if (!Number.isSafeInteger(urgentThreshold) || !Number.isSafeInteger(warningThreshold) || urgentThreshold < 0 || warningThreshold < urgentThreshold) {
      throw new InventoryError(400, "Проверьте пороги «Срочно» и «Внимание».");
    }
    const store = await prisma.$transaction(async tx => {
      const member = await requireManager(tx, user.id);
      const updated = await tx.store.update({ where: { id: member.storeId }, data: { urgentThreshold, warningThreshold } });
      await tx.telegramWarning.deleteMany({ where: { userId: { in: (await tx.storeMembership.findMany({ where: { storeId: member.storeId } })).map(m => m.userId) } } });
      return updated;
    });
    return res.json({ store });
  } catch (error) { return apiFailure(res, error); }
}
