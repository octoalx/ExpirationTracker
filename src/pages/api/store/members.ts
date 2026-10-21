import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { storeMembership, InventoryError } from "@/lib/server/inventory";
import { createEmployee, revokeMembership, renameOwnDepartment } from "@/lib/server/departments";

/**
 * GET: the caller's department and its members.
 * POST: a manager creates an employee account with login and password.
 * PUT: a manager renames their own department.
 * DELETE: a manager revokes an employee's access to the department.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "private, no-store");
      const membership = await storeMembership(prisma, user.id);
      return res.json({ store: membership?.store ?? null, role: membership?.role ?? null,
        isAdmin: user.role === "ADMIN",
        members: membership ? await prisma.storeMembership.findMany({ where: { storeId: membership.storeId },
          select: { userId: true, role: true, user: { select: { name: true, email: true } } } }) : [] });
    }
    if (req.method === "POST") {
      const employee = await createEmployee(prisma, user.id, req.body ?? {});
      return res.status(201).json({ success: true, employee });
    }
    if (req.method === "PUT") {
      const store = await renameOwnDepartment(prisma, user.id, req.body?.name);
      return res.json({ store });
    }
    if (req.method === "DELETE") {
      const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
      if (!userId) throw new InventoryError(400, "Выберите сотрудника.");
      await revokeMembership(prisma, user.id, userId);
      return res.json({ success: true });
    }
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  } catch (error) { return apiFailure(res, error); }
}
