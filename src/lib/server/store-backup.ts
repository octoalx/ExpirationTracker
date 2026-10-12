import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

const date = z.coerce.date();
const extension = z.object({
  stores: z.array(z.object({ id: z.literal("main"), name: z.string().min(1).max(100), urgentThreshold: z.number().int().nonnegative(), warningThreshold: z.number().int().nonnegative() }).refine(s => s.warningThreshold >= s.urgentThreshold)).default([]),
  memberships: z.array(z.object({ id: z.string(), storeId: z.literal("main"), userId: z.string(), role: z.enum(["MANAGER", "EMPLOYEE"]), createdAt: date })).default([]),
  productEvents: z.array(z.object({ id: z.string(), productId: z.string().nullable(), storeId: z.string().nullable(), actorId: z.string(), actorName: z.string(), source: z.enum(["WEB", "TELEGRAM"]), action: z.string(), details: z.string(), key: z.string(), createdAt: date })).default([]),
  telegramLinks: z.array(z.object({ userId: z.string(), telegramUserId: z.string(), chatId: z.string(), displayName: z.string(), deliveryStatus: z.string(), createdAt: date })).default([]),
  telegramWarnings: z.array(z.object({ id: z.string(), userId: z.string(), productId: z.string(), fingerprint: z.string() })).default([]),
  telegramDeliveries: z.array(z.object({ id: z.string(), key: z.string(), userId: z.string(), kind: z.string(), scheduleDate: z.string(), state: z.string(), attempts: z.number().int().nonnegative(), availableAt: date, leaseUntil: date.nullable(), messageId: z.string().nullable(), error: z.string().nullable(), sentAt: date.nullable(), createdAt: date })).default([]),
});
export function parseStoreBackup(data: unknown) { return extension.parse(data); }

export async function exportStoreBackup(db: PrismaClient | Prisma.TransactionClient) {
  const [stores, memberships, productEvents, telegramLinks, telegramWarnings, telegramDeliveries] = await Promise.all([
    db.store.findMany(), db.storeMembership.findMany(), db.productEvent.findMany(), db.telegramLink.findMany(),
    db.telegramWarning.findMany(), db.telegramDelivery.findMany(),
  ]);
  // Claims, button tokens, pending account links and raw inbound messages expire on restore.
  return { stores, memberships, productEvents, telegramLinks, telegramWarnings, telegramDeliveries };
}

export async function prepareStoreRestore(tx: Prisma.TransactionClient, replace: boolean) {
  await tx.integrationState.upsert({ where: { id: "telegram" }, create: { id: "telegram", paused: true }, update: { paused: true } });
  await tx.telegramButton.deleteMany(); await tx.telegramLinkRequest.deleteMany(); await tx.productClaim.deleteMany();
  await tx.telegramUpdate.updateMany({ where: { state: { in: ["QUEUED", "PROCESSING"] } }, data: { state: "CANCELLED", payload: "{}", leaseUntil: null } });
  await tx.telegramDelivery.updateMany({ where: { state: { in: ["QUEUED", "PROCESSING"] } }, data: { state: "CANCELLED", leaseUntil: null } });
  if (replace) {
    await tx.telegramLink.deleteMany(); await tx.telegramWarning.deleteMany(); await tx.telegramDelivery.deleteMany();
    await tx.productEvent.deleteMany(); await tx.storeMembership.deleteMany();
  }
}

export async function restoreStoreHeader(tx: Prisma.TransactionClient, data: ReturnType<typeof parseStoreBackup>, userMap: Map<string, string>, replace: boolean) {
  if (replace) await tx.store.deleteMany();
  for (const store of data.stores) await tx.store.upsert({ where: { id: store.id }, create: store, update: store });
  for (const membership of data.memberships) {
    const userId = userMap.get(membership.userId) ?? membership.userId;
    if (!(await tx.user.findUnique({ where: { id: userId } }))) throw new Error("Missing restored member");
    await tx.storeMembership.upsert({ where: { userId }, create: { ...membership, userId }, update: { storeId: membership.storeId, role: membership.role } });
  }
}

export async function restoreStoreDetails(tx: Prisma.TransactionClient, data: ReturnType<typeof parseStoreBackup>, userMap: Map<string, string>) {
  for (const event of data.productEvents) {
    if (event.productId && !(await tx.product.findUnique({ where: { id: event.productId } }))) throw new Error("Missing restored product");
    await tx.productEvent.upsert({ where: { key: event.key }, update: {}, create: { ...event, actorId: userMap.get(event.actorId) ?? event.actorId } });
  }
  for (const link of data.telegramLinks) {
    const userId = userMap.get(link.userId) ?? link.userId;
    await tx.telegramLink.upsert({ where: { userId }, create: { ...link, userId }, update: { ...link, userId } });
  }
  for (const state of data.telegramWarnings) {
    const userId = userMap.get(state.userId) ?? state.userId;
    await tx.telegramWarning.upsert({ where: { userId_productId: { userId, productId: state.productId } },
      create: { ...state, userId }, update: { fingerprint: state.fingerprint } });
  }
  for (const delivery of data.telegramDeliveries) {
    const userId = userMap.get(delivery.userId) ?? delivery.userId;
    const state = ["QUEUED", "PROCESSING"].includes(delivery.state) ? "CANCELLED" : delivery.state;
    await tx.telegramDelivery.upsert({ where: { key: delivery.key }, update: {}, create: { ...delivery, userId, state, leaseUntil: null } });
  }
}
