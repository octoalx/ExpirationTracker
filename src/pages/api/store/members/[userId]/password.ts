import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { InventoryError } from "@/lib/server/inventory";
import { resetEmployeePassword } from "@/lib/server/departments";

/** POST: the manager of the department issues a new password for one employee. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    if (!userId) throw new InventoryError(400, "Выберите сотрудника.");
    await resetEmployeePassword(prisma, user.id, userId, req.body?.password);
    return res.json({ success: true });
  } catch (error) { return apiFailure(res, error); }
}
