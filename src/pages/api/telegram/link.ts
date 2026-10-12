import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { apiUser, apiFailure } from "@/lib/server/api";
import { confirmLink, createLinkRequest, unlinkTelegram } from "@/lib/server/telegram-link";
import { telegramPaused } from "@/lib/server/telegram-jobs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await apiUser(req, res);
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method === "GET") {
      const link = await prisma.telegramLink.findUnique({ where: { userId: user.id },
        select: { displayName: true, deliveryStatus: true } });
      const request = await prisma.telegramLinkRequest.findUnique({ where: { userId: user.id } });
      return res.json({ configured: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_BOT_USERNAME,
        paused: await telegramPaused(prisma),
        link, pending: request && request.expiresAt > new Date() ? {
          displayName: request.displayName, confirmation: request.telegramUserId ? request.tokenHash : null, expiresAt: request.expiresAt } : null });
    }
    if (req.method === "DELETE") { await unlinkTelegram(prisma, user.id); return res.json({ success: true }); }
    if (req.method !== "POST") return res.status(405).end();
    if (req.body?.confirmation) return res.json(await confirmLink(prisma, user.id, req.body.confirmation));
    return res.json(await createLinkRequest(prisma, user.id));
  } catch (error) { return apiFailure(res, error); }
}
