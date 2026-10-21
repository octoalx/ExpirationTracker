import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { InventoryError } from "@/lib/server/inventory";
import { appointManager, createDepartment, deleteDepartment, grantSupportAccess,
  listDepartments, renameDepartment, revokeSupportAccess } from "@/lib/server/departments";

/**
 * Administrator department registry.
 * GET returns departments with their managers and the accounts that belong to none.
 * POST performs one operation per call; every action is scoped by the ADMIN role
 * and the caller never receives a product row.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (user.role !== "ADMIN") throw new InventoryError(403, "Нужны права администратора.");

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, no-store");
      const departments = await listDepartments(prisma);
      const unassigned = await prisma.user.findMany({
        where: { membership: { is: null } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
      return res.json({ departments, unassigned });
    }

    if (req.method !== "POST") return res.status(405).end();
    const body = req.body ?? {};
    switch (body.operation) {
      case "create": return res.status(201).json(await createDepartment(prisma, user.id, body));
      case "rename": return res.json(await renameDepartment(prisma, body));
      case "appoint": return res.json(await appointManager(prisma, user.id, body));
      case "delete": return res.json(await deleteDepartment(prisma, user.id, body));
      case "support": {
        const storeId = typeof body.storeId === "string" ? body.storeId : "";
        if (!storeId) throw new InventoryError(400, "Выберите отдел.");
        return res.json(await grantSupportAccess(prisma, user.id, storeId));
      }
      case "supportEnd": return res.json(await revokeSupportAccess(prisma, user.id));
      default: throw new InventoryError(400, "Неизвестная операция.");
    }
  } catch (error) { return apiFailure(res, error); }
}
