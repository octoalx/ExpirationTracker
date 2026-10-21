import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { storeMembership } from "@/lib/server/inventory";
import { saveDepartmentThresholds } from "@/lib/server/departments";

/**
 * GET: the caller's department, for the department and settings screens.
 * POST: the manager saves the department thresholds. An employee, and a support
 * visit, are refused; validation lives with the write so every caller shares it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method === "GET") {
      const membership = await storeMembership(prisma, user.id);
      return res.json({ store: membership?.store ?? null, role: membership?.role ?? null });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    const store = await saveDepartmentThresholds(prisma, user.id, req.body ?? {});
    return res.json({ store });
  } catch (error) { return apiFailure(res, error); }
}
