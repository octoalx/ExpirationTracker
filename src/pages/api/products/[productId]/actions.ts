import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { inspectProduct } from "@/lib/server/inventory";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method !== "POST") return res.status(405).end();
    return res.json(await inspectProduct(prisma, { userId: user.id, source: "WEB" }, String(req.query.productId),
      req.body?.version, req.body?.result, req.body?.key));
  } catch (error) { return apiFailure(res, error); }
}
