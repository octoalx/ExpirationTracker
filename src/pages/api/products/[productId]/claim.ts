import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { claimProduct } from "@/lib/server/inventory";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (!["POST", "DELETE"].includes(req.method ?? "")) return res.status(405).end();
    return res.json({ claim: await claimProduct(prisma, { userId: user.id, source: "WEB" }, String(req.query.productId), req.method === "DELETE") });
  } catch (error) { return apiFailure(res, error); }
}
