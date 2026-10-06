import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { InventoryError, inventoryScope } from "./inventory";

export const linkHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createLinkRequest(db: PrismaClient, userId: string, now = new Date()) {
  if (!(await inventoryScope(db, userId)).membership) throw new InventoryError(403, "Сначала вступите в команду магазина.");
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!username || !/^[A-Za-z0-9_]+$/.test(username) || !process.env.TELEGRAM_BOT_TOKEN) {
    throw new InventoryError(503, "Администратор ещё не настроил бота.");
  }
  const token = randomBytes(24).toString("base64url");
  const data = { tokenHash: linkHash(token), expiresAt: new Date(now.getTime() + 600000),
    telegramUserId: null, chatId: null, displayName: null };
  await db.telegramLinkRequest.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { url: `https://t.me/${username}?start=${token}`, expiresAt: data.expiresAt };
}

/** A start payload only nominates a Telegram account; the web session confirms it. */
export async function nominateLink(db: PrismaClient, tokenHash: string,
  telegramUserId: string, chatId: string, displayName: string, now = new Date()) {
  return db.$transaction(async tx => {
    const request = await tx.telegramLinkRequest.findUnique({ where: { tokenHash } });
    if (!request || request.expiresAt <= now || request.telegramUserId) throw new InventoryError(400, "Ссылка недействительна. Создайте новую в настройках.");
    if (!(await inventoryScope(tx, request.userId)).membership) throw new InventoryError(403, "Доступ к магазину отозван.");
    const existing = await tx.telegramLink.findUnique({ where: { telegramUserId } });
    if (existing && existing.userId !== request.userId) throw new InventoryError(409, "Telegram уже связан с другим аккаунтом.");
    const changed = await tx.telegramLinkRequest.updateMany({ where: { tokenHash, telegramUserId: null, expiresAt: { gt: now } },
      data: { telegramUserId, chatId, displayName: displayName.slice(0, 100) } });
    if (!changed.count) throw new InventoryError(409, "Ссылка уже использована.");
  });
}

export async function confirmLink(db: PrismaClient, userId: string, expectedHash: string, now = new Date()) {
  return db.$transaction(async tx => {
    if (!(await inventoryScope(tx, userId)).membership) throw new InventoryError(403, "Доступ к магазину отозван.");
    const request = await tx.telegramLinkRequest.findUnique({ where: { userId } });
    if (!request || request.tokenHash !== expectedHash || request.expiresAt <= now || !request.telegramUserId || !request.chatId) {
      throw new InventoryError(400, "Откройте актуальную ссылку бота и повторите подтверждение.");
    }
    const data = { telegramUserId: request.telegramUserId, chatId: request.chatId,
      displayName: request.displayName ?? "Telegram", deliveryStatus: "READY" };
    const previous = await tx.telegramLink.findUnique({ where: { userId } });
    await tx.telegramLink.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await tx.telegramLinkRequest.delete({ where: { userId } });
    await tx.telegramButton.deleteMany({ where: { userId } });
    if (previous?.telegramUserId !== data.telegramUserId) await tx.telegramWarning.deleteMany({ where: { userId } });
    await tx.settings.upsert({ where: { userId }, create: { userId, telegramNotifications: true }, update: { telegramNotifications: true } });
    return { displayName: data.displayName };
  });
}

export async function unlinkTelegram(db: PrismaClient, userId: string) {
  await db.$transaction(async tx => {
    await tx.telegramLink.deleteMany({ where: { userId } });
    await tx.telegramLinkRequest.deleteMany({ where: { userId } });
    await tx.telegramButton.deleteMany({ where: { userId } });
    await tx.telegramWarning.deleteMany({ where: { userId } });
    await tx.telegramDelivery.updateMany({ where: { userId, state: { in: ["QUEUED", "PROCESSING"] } }, data: { state: "CANCELLED" } });
    await tx.settings.updateMany({ where: { userId }, data: { telegramNotifications: false } });
  });
}
