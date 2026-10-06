import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { expiryDays, minskDate } from "../expiry-calendar";

type Database = PrismaClient | Prisma.TransactionClient;
export class InventoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Actor = { userId: string; source: "WEB" | "TELEGRAM" };
export const RESULTS = ["CHECKED", "MISSING", "SOLD", "REMOVED", "DEFECT"] as const;
export type InspectionResult = typeof RESULTS[number];

export async function inventoryScope(db: Database, userId: string) {
  const membership = await db.storeMembership.findUnique({ where: { userId }, include: { store: true } });
  const where: Prisma.ProductWhereInput = membership
    ? { storeId: membership.storeId, deletedAt: null }
    : { userId, storeId: null, deletedAt: null };
  return { membership, where };
}

export async function inventoryThresholds(db: Database, userId: string) {
  const scope = await inventoryScope(db, userId);
  const settings = scope.membership?.store ?? await db.settings.findUnique({ where: { userId } });
  return { urgentThreshold: settings?.urgentThreshold ?? 3, warningThreshold: settings?.warningThreshold ?? 7 };
}

export async function requireManager(db: Database, userId: string) {
  const { membership } = await inventoryScope(db, userId);
  if (membership?.role !== "MANAGER") throw new InventoryError(403, "Нужны права руководителя магазина.");
  return membership;
}

export async function accessibleProduct(db: Database, userId: string, id: string) {
  const { where, membership } = await inventoryScope(db, userId);
  const product = await db.product.findFirst({ where: { ...where, id } });
  if (!product) throw new InventoryError(404, "Товар недоступен. Обновите список.");
  return { product, membership };
}

export async function recordEvent(db: Database, actor: Actor, product: { id: string; storeId: string | null },
  action: string, details: unknown, key: string = randomUUID()) {
  const user = await db.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
  return db.productEvent.create({ data: { productId: product.id, storeId: product.storeId,
    actorId: actor.userId, actorName: user?.name ?? "Сотрудник", source: actor.source,
    action, details: JSON.stringify(details), key } });
}

/** Compare-and-swap inside the same transaction as the audit event. */
export async function updateInventory(db: PrismaClient, actor: Actor, id: string, version: unknown,
  data: Prisma.ProductUncheckedUpdateManyInput, action = "EDIT") {
  return db.$transaction(async tx => {
    const { product, membership } = await accessibleProduct(tx, actor.userId, id);
    if (membership && (!Number.isInteger(version) || version !== product.version)) {
      throw new InventoryError(409, "Запись изменилась. Обновите её и повторите действие.");
    }
    const changed = await tx.product.updateMany({ where: { id, version: product.version },
      data: { ...data, version: { increment: 1 } } });
    if (!changed.count) throw new InventoryError(409, "Запись уже изменена другим сотрудником.");
    if ("expiryDate" in data) await tx.telegramWarning.deleteMany({ where: { productId: id } });
    await recordEvent(tx, actor, product, action, { before: product, changes: data });
    return tx.product.findUniqueOrThrow({ where: { id } });
  });
}

export async function claimProduct(db: PrismaClient, actor: Actor, id: string, release = false, now = new Date()) {
  return db.$transaction(async tx => {
    const { product, membership } = await accessibleProduct(tx, actor.userId, id);
    if (!membership) throw new InventoryError(403, "Обход доступен сотрудникам магазина.");
    if (product.status !== "ACTIVE") throw new InventoryError(409, "Товар уже обработан.");
    await tx.productClaim.deleteMany({ where: { productId: id, expiresAt: { lte: now } } });
    const previous = await tx.productClaim.findUnique({ where: { productId: id } });
    if (previous && previous.userId !== actor.userId) {
      throw new InventoryError(409, "Этот товар уже проверяет другой сотрудник.");
    }
    if (release) {
      await tx.productClaim.deleteMany({ where: { productId: id, userId: actor.userId } });
      return null;
    }
    return tx.productClaim.upsert({ where: { productId: id },
      create: { productId: id, userId: actor.userId, expiresAt: new Date(now.getTime() + 600000) },
      update: { expiresAt: new Date(now.getTime() + 600000) } });
  });
}

export async function inspectProduct(db: PrismaClient, actor: Actor, id: string, version: number,
  result: InspectionResult, key: string, now = new Date()) {
  if (!RESULTS.includes(result) || !key || key.length > 120 || !Number.isInteger(version)) {
    throw new InventoryError(400, "Некорректный результат проверки.");
  }
  return db.$transaction(async tx => {
    const { product, membership } = await accessibleProduct(tx, actor.userId, id);
    if (!membership) throw new InventoryError(403, "Обход доступен сотрудникам магазина.");
    const previous = await tx.productEvent.findUnique({ where: { key } });
    if (previous) {
      if (previous.actorId !== actor.userId || previous.productId !== id || previous.action !== result) {
        throw new InventoryError(409, "Этот запрос уже использован.");
      }
      return product;
    }
    if (product.version !== version || product.status !== "ACTIVE") throw new InventoryError(409, "Запись изменилась. Обновите карточку.");
    const claim = await tx.productClaim.findUnique({ where: { productId: id } });
    if (!claim || claim.userId !== actor.userId || claim.expiresAt <= now) {
      throw new InventoryError(409, "Возьмите товар на проверку заново.");
    }
    const closing = result === "SOLD" || result === "REMOVED" || result === "DEFECT";
    const changes = { checkedAt: now, checkedBy: actor.userId, missing: result === "MISSING",
      ...(closing ? { status: result === "DEFECT" ? "DEFECT" : "ARCHIVED", resolution: result } : {}),
      version: { increment: 1 } };
    const changed = await tx.product.updateMany({ where: { id, version }, data: changes });
    if (!changed.count) throw new InventoryError(409, "Запись уже изменена.");
    await recordEvent(tx, actor, product, result, { before: product, changes }, key);
    await tx.productClaim.deleteMany({ where: { productId: id } });
    return tx.product.findUniqueOrThrow({ where: { id } });
  });
}

export async function worklist(db: Database, userId: string, now = new Date()) {
  const scope = await inventoryScope(db, userId);
  if (!scope.membership) throw new InventoryError(403, "Вы пока не включены в команду магазина.");
  const thresholds = scope.membership.store;
  const products = await db.product.findMany({ where: { ...scope.where, status: "ACTIVE" }, include: { claim: true } });
  const members = await db.storeMembership.findMany({ where: { storeId: scope.membership.storeId },
    include: { user: { select: { name: true } } } });
  const names = new Map(members.map(m => [m.userId, m.user.name ?? "Сотрудник"]));
  const rows = products.map(p => ({ ...p, daysLeft: expiryDays(p.expiryDate, now),
    checkedByName: p.checkedBy ? names.get(p.checkedBy) ?? "Бывший сотрудник" : null,
    checkedToday: !!p.checkedAt && minskDate(p.checkedAt) === minskDate(now),
    claim: p.claim && p.claim.expiresAt > now ? { ...p.claim, name: names.get(p.claim.userId) ?? "Сотрудник" } : null }));
  rows.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.name.localeCompare(b.name));
  const events = await db.productEvent.findMany({ where: { storeId: scope.membership.storeId,
    createdAt: { gte: new Date(`${minskDate(now)}T00:00:00+03:00`) }, action: { in: [...RESULTS] } } });
  return { store: scope.membership.store, role: scope.membership.role,
    counts: { expired: rows.filter(p => p.daysLeft !== null && p.daysLeft < 0).length,
      urgent: rows.filter(p => p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= thresholds.urgentThreshold).length,
      warning: rows.filter(p => p.daysLeft !== null && p.daysLeft > thresholds.urgentThreshold && p.daysLeft <= thresholds.warningThreshold).length,
      unknown: rows.filter(p => p.daysLeft === null).length, missing: rows.filter(p => p.missing).length,
      checked: new Set(events.map(e => e.productId)).size,
      resolved: new Set(events.filter(e => ["SOLD", "REMOVED", "DEFECT"].includes(e.action)).map(e => e.productId)).size },
    products: rows.filter(p => p.daysLeft === null || p.missing ||
      (p.daysLeft <= thresholds.warningThreshold && (!p.checkedToday || p.daysLeft < 0))) };
}
