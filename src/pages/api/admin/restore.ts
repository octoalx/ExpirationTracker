import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { parseStoreBackup, prepareStoreRestore, restoreStoreHeader, restoreStoreDetails } from "@/lib/server/store-backup";
import { expiredOn } from "@/lib/expiry-calendar";
import { suspendTelegram, resumeTelegramRuntime } from "@/lib/server/telegram-runtime";

interface BackupData {
  version?: string;
  exportedAt?: string;
  data?: {
    users?: Array<{
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
    }>;
    products?: Array<{
      id: string;
      name: string;
      barcode: string;
      expiryDate?: string | Date | null;
      manufacturingDate?: string | null;
      shelfLife?: number | null;
      shelfLifeUnit?: string | null;
      status?: string;
      isExpired?: boolean;
      quantity?: number | null;
      createdAt?: string | Date;
      updatedAt?: string | Date;
      userId: string | null;
      storeId?: string | null;
      version?: number;
      resolution?: string | null;
      missing?: boolean;
      checkedAt?: string | null;
      checkedBy?: string | null;
      deletedAt?: string | null;
    }>;
    settings?: Array<{
      id?: string;
      userId: string;
      telegramToken?: string | null;
      telegramChatId?: string | null;
      telegramNotifications?: boolean;
      notificationEmail?: string | null;
      emailNotifications?: boolean;
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpUser?: string | null;
      smtpPass?: string | null;
      urgentThreshold?: number;
      warningThreshold?: number;
      urgentNotifyTime?: string;
      warningNotifyTime?: string;
    }>;
  };
}

/** POST: import a JSON backup with merge or replace mode (admin only). */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const { data, mode = "merge" }: { data: BackupData; mode?: "merge" | "replace" } = req.body;

    if (!data || !data.data) {
      return res.status(400).json({ message: "Invalid backup data" });
    }
    if (mode !== "merge" && mode !== "replace") {
      return res.status(400).json({ message: "Invalid restore mode" });
    }
    if (data.data.products?.some(product => product.expiryDate != null && !Number.isFinite(new Date(product.expiryDate).getTime()))) {
      return res.status(400).json({ message: "Invalid expiry date in backup" });
    }

    const results = {
      users: { created: 0, updated: 0, skipped: 0 },
      products: { created: 0, updated: 0, skipped: 0 },
      settings: { created: 0, updated: 0, skipped: 0 },
    };
    let extension;
    try { extension = parseStoreBackup(data.data); }
    catch { return res.status(400).json({ message: "Некорректные данные магазина в копии." }); }
    const userMap = new Map<string, string>();
    if (!suspendTelegram()) return res.status(409).json({ message: "Telegram завершает текущее действие. Повторите восстановление через минуту." });

    // Keep replacement and all imported records atomic if any write fails.
    await prisma.$transaction(async transaction => {
      await prepareStoreRestore(transaction, mode === "replace");
      // In replace mode, wipe all existing data first
      if (mode === "replace") {
        await transaction.emailLog.deleteMany();
        await transaction.systemLog.deleteMany();
        await transaction.product.deleteMany();
        await transaction.settings.deleteMany();
        await transaction.user.deleteMany();
      }

      // Restore users from backup
      if (data.data.users && data.data.users.length > 0) {
        for (const user of data.data.users) {
          if (!user.email) {
            results.users.skipped++;
            continue;
          }

          const existing = await transaction.user.findUnique({
            where: { email: user.email },
          });

          if (existing && mode === "merge") {
            userMap.set(user.id, existing.id);
            await transaction.user.update({
              where: { id: existing.id },
              data: {
                name: user.name ?? existing.name,
                role: (user.role as Role) ?? existing.role,
              },
            });
            results.users.updated++;
          } else if (!existing) {
            userMap.set(user.id, user.id);
            await transaction.user.create({
              data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: (user.role as Role) ?? Role.USER,
              },
            });
            results.users.created++;
          } else {
            results.users.skipped++;
          }
        }
      }

      await restoreStoreHeader(transaction, extension, userMap, mode === "replace");

      // Restore products from backup
      if (data.data.products && data.data.products.length > 0) {
        for (const product of data.data.products) {
          const userId = product.userId ? userMap.get(product.userId) ?? product.userId : null;
          const userExists = userId ? await transaction.user.findUnique({ where: { id: userId } }) : null;
          if (!userExists && !product.storeId) {
            results.products.skipped++;
            continue;
          }
          const existing = await transaction.product.findUnique({ where: { id: product.id } });
          const legacyMerge = existing && mode === "merge" && product.storeId === undefined;
          const operational = legacyMerge ? { storeId: existing.storeId, version: existing.version + 1,
            resolution: existing.resolution, missing: existing.missing, checkedAt: existing.checkedAt,
            checkedBy: existing.checkedBy, deletedAt: existing.deletedAt } : { storeId: product.storeId ?? null, version: product.version ?? 0,
            resolution: product.resolution ?? null, missing: product.missing ?? false,
            checkedAt: product.checkedAt ? new Date(product.checkedAt) : null,
            checkedBy: product.checkedBy ? userMap.get(product.checkedBy) ?? product.checkedBy : null,
            deletedAt: product.deletedAt ? new Date(product.deletedAt) : null };

          if (existing && mode === "merge") {
            await transaction.product.update({
              where: { id: existing.id },
              data: {
                ...operational,
                name: product.name,
                barcode: product.barcode,
                expiryDate: product.expiryDate == null ? null : new Date(product.expiryDate),
                manufacturingDate: product.manufacturingDate ?? null,
                shelfLife: product.shelfLife ?? null,
                shelfLifeUnit: product.shelfLifeUnit ?? null,
                status: product.status ?? "ACTIVE",
                isExpired: expiredOn(product.expiryDate),
                quantity: product.quantity,
              },
            });
            results.products.updated++;
          } else if (!existing) {
            await transaction.product.create({
              data: {
                ...operational,
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                expiryDate: product.expiryDate == null ? null : new Date(product.expiryDate),
                manufacturingDate: product.manufacturingDate ?? null,
                shelfLife: product.shelfLife ?? null,
                shelfLifeUnit: product.shelfLifeUnit ?? null,
                status: product.status ?? "ACTIVE",
                isExpired: expiredOn(product.expiryDate),
                quantity: product.quantity,
                userId: userExists ? userId : null,
                createdAt: product.createdAt ? new Date(product.createdAt) : undefined,
                updatedAt: product.updatedAt ? new Date(product.updatedAt) : undefined,
              },
            });
            results.products.created++;
          } else {
            results.products.skipped++;
          }
        }
      }

      // Restore settings from backup
      if (data.data.settings && data.data.settings.length > 0) {
        for (const settings of data.data.settings) {
          settings.userId = userMap.get(settings.userId) ?? settings.userId;
          const userExists = await transaction.user.findUnique({
            where: { id: settings.userId },
          });
          if (!userExists) {
            results.settings.skipped++;
            continue;
          }

          const existing = await transaction.settings.findUnique({
            where: { userId: settings.userId },
          });

          if (existing && mode === "merge") {
            await transaction.settings.update({
              where: { userId: settings.userId },
              data: {
                telegramNotifications: settings.telegramNotifications ?? existing.telegramNotifications,
                emailNotifications: settings.emailNotifications ?? existing.emailNotifications,
                urgentThreshold: settings.urgentThreshold ?? existing.urgentThreshold,
                warningThreshold: settings.warningThreshold ?? existing.warningThreshold,
              },
            });
            results.settings.updated++;
          } else if (!existing) {
            await transaction.settings.create({
              data: {
                userId: settings.userId,
                telegramToken: settings.telegramToken,
                telegramChatId: settings.telegramChatId,
                telegramNotifications: settings.telegramNotifications ?? true,
                notificationEmail: settings.notificationEmail,
                emailNotifications: settings.emailNotifications ?? false,
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort,
                smtpUser: settings.smtpUser,
                smtpPass: settings.smtpPass,
                urgentThreshold: settings.urgentThreshold ?? 3,
                warningThreshold: settings.warningThreshold ?? 7,
                urgentNotifyTime: settings.urgentNotifyTime ?? "10:00",
                warningNotifyTime: settings.warningNotifyTime ?? "10:00",
              },
            });
            results.settings.created++;
          } else {
            results.settings.skipped++;
          }
        }
      }

      await restoreStoreDetails(transaction, extension, userMap);
      await transaction.systemLog.create({
        data: {
          level: "INFO",
          message: `Admin ${session.user.email} imported database backup (${mode} mode)`,
          meta: JSON.stringify({ adminId: session.user.id, mode, results }),
        },
      });
    });
    resumeTelegramRuntime();

    res.status(200).json({
      success: true,
      mode,
      results,
    });
  } catch (error) {
    resumeTelegramRuntime();
    apiErrorHandler(error, res);
  }
}
