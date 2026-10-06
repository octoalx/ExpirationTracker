import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { InventoryError } from "@/lib/server/inventory";
import { telegramPaused } from "@/lib/server/telegram-jobs";
import { resumeTelegramRuntime } from "@/lib/server/telegram-runtime";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await apiUser(req, res);
    if (user.role !== "ADMIN") throw new InventoryError(403, "Нужны права администратора.");
    if (req.method === "GET") {
      return res.json({ paused: await telegramPaused(prisma), configured: !!process.env.TELEGRAM_BOT_TOKEN,
        deliveries: await prisma.telegramDelivery.findMany({ select: { id: true, state: true, kind: true, scheduleDate: true, attempts: true, error: true, sentAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
        failedUpdates: await prisma.telegramUpdate.count({ where: { state: "FAILED" } }) });
    }
    if (req.method !== "POST" || typeof req.body?.paused !== "boolean") return res.status(400).json({ message: "Укажите paused." });
    await prisma.integrationState.upsert({ where: { id: "telegram" }, create: { id: "telegram", paused: req.body.paused }, update: { paused: req.body.paused } });
    if (!req.body.paused) resumeTelegramRuntime();
    return res.json({ success: true });
  } catch (error) { return apiFailure(res, error); }
}
