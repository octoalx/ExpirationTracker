import type { PrismaClient } from "@prisma/client";
import { expiryDays, expiryLabel, minskDate, minskTime } from "../expiry-calendar";
import { handleBotUpdate, menuButtons } from "./telegram-bot";
import { inventoryScope, worklist } from "./inventory";
import { transportFailure, type BotTransport } from "./telegram-transport";

export async function telegramPaused(db: PrismaClient) {
  return (await db.integrationState.findUnique({ where: { id: "telegram" } }))?.paused ?? false;
}

/** Capture due schedules once per recipient/day. No historical daily backlog. */
export async function scheduleTelegram(db: PrismaClient, now = new Date()) {
  if (await telegramPaused(db)) return;
  const day = minskDate(now), time = minskTime(now);
  const links = await db.telegramLink.findMany({ where: { deliveryStatus: "READY" }, include: { user: { include: { settings: true, membership: { include: { store: true } } } } } });
  for (const link of links) {
    const { settings, membership } = link.user;
    if (!membership || !settings?.telegramNotifications) continue;
    const products = await db.product.findMany({ where: { storeId: membership.storeId, status: "ACTIVE", deletedAt: null } });
    const warningIds = products.filter(p => {
      const days = expiryDays(p.expiryDate, now);
      return days !== null && days > membership.store.urgentThreshold && days <= membership.store.warningThreshold;
    }).map(p => p.id);
    // Leaving the band permits another warning on a later re-entry.
    await db.telegramWarning.deleteMany({ where: { userId: link.userId, productId: { notIn: warningIds } } });
    const times = settings.urgentNotifyTime === settings.warningNotifyTime
      ? [{ time: settings.urgentNotifyTime, kind: "BOTH" }]
      : [{ time: settings.urgentNotifyTime, kind: "URGENT" }, { time: settings.warningNotifyTime, kind: "WARNING" }];
    for (const slot of times) {
      if (time < slot.time) continue;
      const key = `${link.userId}:${slot.kind}:${day}`;
      await db.telegramDelivery.upsert({ where: { key }, update: {}, create: { key, userId: link.userId, kind: slot.kind, scheduleDate: day, availableAt: now } });
    }
  }
}

function fingerprint(p: { expiryDate: Date | null }, store: { id: string; urgentThreshold: number; warningThreshold: number }) {
  return `${store.id}:${expiryLabel(p.expiryDate)}:${store.urgentThreshold}:${store.warningThreshold}`;
}

export async function processDeliveries(db: PrismaClient, transport: BotTransport, now = new Date()) {
  if (await telegramPaused(db)) return;
  await db.telegramDelivery.updateMany({ where: { state: "PROCESSING", leaseUntil: { lte: now }, attempts: { gte: 6 } }, data: { state: "FAILED", leaseUntil: null, error: "LEASE_EXPIRED_UNCERTAIN" } });
  await db.telegramDelivery.updateMany({ where: { state: "PROCESSING", leaseUntil: { lte: now } },
    data: { state: "QUEUED", leaseUntil: null, error: "LEASE_EXPIRED_UNCERTAIN" } });
  const due = await db.telegramDelivery.findMany({ where: { state: "QUEUED", availableAt: { lte: now } }, orderBy: { createdAt: "asc" }, take: 20 });
  for (const delivery of due) {
    if (await telegramPaused(db)) return;
    const taken = await db.telegramDelivery.updateMany({ where: { id: delivery.id, state: "QUEUED", availableAt: { lte: now } },
      data: { state: "PROCESSING", attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + 120000) } });
    if (!taken.count) continue;
    try {
      const link = await db.telegramLink.findUnique({ where: { userId: delivery.userId } });
      const settings = await db.settings.findUnique({ where: { userId: delivery.userId } });
      const { membership, where } = await inventoryScope(db, delivery.userId);
      if (!link || link.deliveryStatus !== "READY" || !membership || !settings?.telegramNotifications || delivery.scheduleDate !== minskDate(now)) {
        await db.telegramDelivery.update({ where: { id: delivery.id }, data: { state: "CANCELLED", leaseUntil: null } });
        continue;
      }
      const products = await db.product.findMany({ where: { ...where, status: "ACTIVE" } });
      const states = await db.telegramWarning.findMany({ where: { userId: delivery.userId } });
      const stateMap = new Map(states.map(s => [s.productId, s.fingerprint]));
      const urgent = products.filter(p => { const days = expiryDays(p.expiryDate, now); return days !== null && days <= membership.store.urgentThreshold; });
      const warning = products.filter(p => { const days = expiryDays(p.expiryDate, now); return days !== null &&
        days > membership.store.urgentThreshold && days <= membership.store.warningThreshold && stateMap.get(p.id) !== fingerprint(p, membership.store); });
      const selected = [...(delivery.kind !== "WARNING" ? urgent : []), ...(delivery.kind !== "URGENT" ? warning : [])];
      selected.sort((a, b) => expiryDays(a.expiryDate, now)! - expiryDays(b.expiryDate, now)! || a.id.localeCompare(b.id));
      if (!selected.length) {
        await db.telegramDelivery.update({ where: { id: delivery.id }, data: { state: "EMPTY", leaseUntil: null } });
        continue;
      }
      const list = await worklist(db, delivery.userId, now);
      const text = `${membership.store.name}\nПросрочено: ${list.counts.expired}; срочно: ${list.counts.urgent}; внимание: ${list.counts.warning}.\nПроверено сегодня: ${list.counts.checked}; не найдены: ${list.counts.missing}; без срока: ${list.counts.unknown}.\n\n` +
        selected.slice(0, 5).map(p => `${p.name.slice(0, 150)} · ${expiryLabel(p.expiryDate)} · ${expiryDays(p.expiryDate, now)} дн.${p.quantity != null ? ` · ${p.quantity} шт.` : ""}${p.missing ? " · не найден" : ""}`).join("\n") +
        (selected.length > 5 ? `\nЕщё записей: ${selected.length - 5}` : "");
      // Recheck revocation immediately before external delivery.
      const current = await db.telegramLink.findUnique({ where: { userId: link.userId } });
      if (current?.telegramUserId !== link.telegramUserId || !(await inventoryScope(db, link.userId)).membership || await telegramPaused(db)) {
        await db.telegramDelivery.update({ where: { id: delivery.id }, data: { state: "CANCELLED", leaseUntil: null } }); continue;
      }
      const sent = await transport.send(link.chatId, text, await menuButtons(db, link.userId, now));
      await db.$transaction(async tx => {
        await tx.telegramDelivery.update({ where: { id: delivery.id }, data: { state: "SENT", messageId: String(sent.message_id), sentAt: now, leaseUntil: null } });
        if (delivery.kind !== "URGENT") for (const p of warning) {
          await tx.telegramWarning.upsert({ where: { userId_productId: { userId: link.userId, productId: p.id } },
            create: { userId: link.userId, productId: p.id, fingerprint: fingerprint(p, membership.store) },
            update: { fingerprint: fingerprint(p, membership.store) } });
        }
      });
    } catch (error) {
      const failure = transportFailure(error);
      const exhausted = delivery.attempts + 1 >= 6;
      const retry = failure.retryable && !exhausted;
      await db.telegramDelivery.updateMany({ where: { id: delivery.id, state: "PROCESSING" }, data: {
        state: failure.blocked || !retry ? "FAILED" : "QUEUED", error: failure.label,
        availableAt: new Date(now.getTime() + (failure.code === 429 ? failure.retryAfter : Math.min(3600, 30 * 2 ** delivery.attempts)) * 1000), leaseUntil: null } });
      if (failure.blocked) await db.telegramLink.updateMany({ where: { userId: delivery.userId }, data: { deliveryStatus: "BLOCKED" } });
    }
  }
}

export async function processInbox(db: PrismaClient, transport: BotTransport, now = new Date()) {
  if (await telegramPaused(db)) return;
  await db.telegramUpdate.updateMany({ where: { state: "PROCESSING", leaseUntil: { lte: now }, attempts: { gte: 6 } }, data: { state: "FAILED", leaseUntil: null } });
  await db.telegramUpdate.updateMany({ where: { state: "PROCESSING", leaseUntil: { lte: now } }, data: { state: "QUEUED", leaseUntil: null } });
  const updates = await db.telegramUpdate.findMany({ where: { state: "QUEUED", availableAt: { lte: now } }, orderBy: { id: "asc" }, take: 20 });
  for (const update of updates) {
    if (await telegramPaused(db)) return;
    const taken = await db.telegramUpdate.updateMany({ where: { id: update.id, state: "QUEUED" }, data: {
      state: "PROCESSING", attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + 120000) } });
    if (!taken.count) continue;
    try {
      await handleBotUpdate(db, transport, JSON.parse(update.payload), now);
      await db.telegramUpdate.update({ where: { id: update.id }, data: { state: "DONE", leaseUntil: null } });
    } catch {
      await db.telegramUpdate.update({ where: { id: update.id }, data: { state: update.attempts >= 5 ? "FAILED" : "QUEUED",
        availableAt: new Date(now.getTime() + 30000 * 2 ** update.attempts), leaseUntil: null } });
    }
  }
  // Keep dedupe tombstones but discard message bodies after processing.
  await db.telegramUpdate.updateMany({ where: { state: "DONE", createdAt: { lt: new Date(now.getTime() - 86400000) } }, data: { payload: "{}" } });
  await db.telegramButton.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.telegramLinkRequest.deleteMany({ where: { expiresAt: { lte: now } } });
}
