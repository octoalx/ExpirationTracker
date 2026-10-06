import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { worklist } from "@/lib/server/inventory";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    if (req.method !== "GET") return res.status(405).end();
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(await worklist(prisma, user.id));
  } catch (error) { return apiFailure(res, error); }
}
