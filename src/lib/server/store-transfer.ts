import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { InventoryError, recordEvent } from "./inventory";

type Database = PrismaClient | Prisma.TransactionClient;
export async function transferPreview(db: Database, managerId: string, userIds: string[]) {
  if (!managerId || !Array.isArray(userIds) || !userIds.length || userIds.length > 100 ||
    userIds.some(id => typeof id !== "string" || !id) || !userIds.includes(managerId)) {
    throw new InventoryError(400, "Выберите руководителя и аккаунты для переноса.");
  }
  const ids = [...new Set(userIds)].sort();
  const users = await db.user.findMany({ where: { id: { in: ids } },
    select: { id: true, name: true, email: true, settings: { select: { urgentThreshold: true, warningThreshold: true } } } });
  if (users.length !== ids.length) throw new InventoryError(400, "Один из аккаунтов недоступен.");
  const memberships = await db.storeMembership.findMany({ where: { userId: { in: ids } } });
  const products = await db.product.findMany({ where: { userId: { in: ids }, storeId: null }, orderBy: { id: "asc" } });
  const groups = new Map<string, number>();
  for (const p of products) {
    const key = `${p.barcode}:${p.expiryDate?.toISOString() ?? "unknown"}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const store = await db.store.findUnique({ where: { id: "main" } });
  const digest = createHash("sha256").update(JSON.stringify({ managerId, ids, products, memberships, store })).digest("hex");
  return { digest, users, records: products.length, unknownExpiry: products.filter(p => !p.expiryDate).length,
    statuses: products.reduce((out, p) => ({ ...out, [p.status]: (out[p.status] ?? 0) + 1 }), {} as Record<string, number>),
    possibleDuplicates: [...groups.values()].filter(n => n > 1).reduce((sum, n) => sum + n, 0) };
}

export async function transferStore(db: PrismaClient, adminId: string,
  input: { managerId: string; userIds: string[]; name: string; digest: string }) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 100) throw new InventoryError(400, "Укажите название магазина.");
  return db.$transaction(async tx => {
    const preview = await transferPreview(tx, input.managerId, input.userIds);
    if (preview.digest !== input.digest) throw new InventoryError(409, "Данные изменились. Повторите предварительную проверку.");
    const manager = preview.users.find(u => u.id === input.managerId)!;
    const store = await tx.store.upsert({ where: { id: "main" }, update: {}, create: {
      id: "main", name: input.name.trim(), urgentThreshold: manager.settings?.urgentThreshold ?? 3,
      warningThreshold: manager.settings?.warningThreshold ?? 7 } });
    for (const user of preview.users) {
      const member = await tx.storeMembership.findUnique({ where: { userId: user.id } });
      if (member && member.storeId !== store.id) throw new InventoryError(409, "Аккаунт уже включён в другой магазин.");
      await tx.storeMembership.upsert({ where: { userId: user.id }, update: user.id === input.managerId ? { role: "MANAGER" } : {},
        create: { userId: user.id, storeId: store.id, role: user.id === input.managerId ? "MANAGER" : "EMPLOYEE" } });
    }
    const products = await tx.product.findMany({ where: { userId: { in: preview.users.map(u => u.id) }, storeId: null } });
    for (const product of products) {
      // Preserve dates, versions and original timestamps; transfer is not a product edit.
      await tx.product.update({ where: { id: product.id }, data: { storeId: store.id, updatedAt: product.updatedAt } });
      await recordEvent(tx, { userId: adminId, source: "WEB" }, { ...product, storeId: store.id },
        "TRANSFER", { originalUserId: product.userId }, `transfer:${store.id}:${product.id}`);
    }
    await tx.telegramWarning.deleteMany({ where: { userId: { in: input.userIds } } });
    return { store, transferred: products.length };
  });
}
