import { timingSafeEqual } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sanitizedUpdate } from "@/lib/server/telegram-bot";
import { tickTelegram } from "@/lib/server/telegram-runtime";

export const config = { api: { bodyParser: { sizeLimit: "128kb" } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.headers["x-telegram-bot-api-secret-token"];
  if (!expected || typeof header !== "string" || Buffer.byteLength(header) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) return res.status(403).end();
  if (!Number.isSafeInteger(req.body?.update_id) || req.body.update_id < 0) return res.status(400).end();
  try {
    await prisma.telegramUpdate.upsert({ where: { id: req.body.update_id }, update: {},
      create: { id: req.body.update_id, payload: JSON.stringify(sanitizedUpdate(req.body)) } });
    res.status(200).json({ ok: true });
    void tickTelegram();
  } catch { return res.status(503).json({ ok: false }); }
}
