import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { InventoryError } from "@/lib/server/inventory";
import { transferPreview, transferStore } from "@/lib/server/store-transfer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (user.role !== "ADMIN") throw new InventoryError(403, "Нужны права администратора.");
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ store: await prisma.store.findUnique({ where: { id: "main" } }),
        users: await prisma.user.findMany({ select: { id: true, name: true, email: true } }) });
    }
    if (req.method !== "POST") return res.status(405).end();
    const input = req.body;
    if (input?.operation === "preview") return res.json(await transferPreview(prisma, input.managerId, input.userIds));
    if (input?.operation === "confirm") return res.json(await transferStore(prisma, user.id, input));
    throw new InventoryError(400, "Неизвестная операция.");
  } catch (error) { return apiFailure(res, error); }
}
