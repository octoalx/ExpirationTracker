import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

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
      expiryDate: string | Date;
      status?: string;
      isExpired?: boolean;
      quantity?: number | null;
      createdAt?: string | Date;
      updatedAt?: string | Date;
      userId: string;
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
      notifyBeforeExpiration?: number;
      urgentThreshold?: number;
      warningThreshold?: number;
      urgentNotifyTime?: string;
      warningNotifyTime?: string;
      theme?: string;
    }>;
  };
}

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

    const results = {
      users: { created: 0, updated: 0, skipped: 0 },
      products: { created: 0, updated: 0, skipped: 0 },
      settings: { created: 0, updated: 0, skipped: 0 },
    };

    // If replace mode, delete all existing data first
    if (mode === "replace") {
      await prisma.$transaction([
        prisma.emailLog.deleteMany(),
        prisma.systemLog.deleteMany(),
        prisma.product.deleteMany(),
        prisma.settings.deleteMany(),
        prisma.user.deleteMany(),
      ]);
    }

    // Restore users
    if (data.data.users && data.data.users.length > 0) {
      for (const user of data.data.users) {
        if (!user.email) {
          results.users.skipped++;
          continue;
        }

        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existing && mode === "merge") {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: user.name ?? existing.name,
              role: user.role ?? existing.role,
            },
          });
          results.users.updated++;
        } else if (!existing) {
          await prisma.user.create({
            data: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role ?? "USER",
            },
          });
          results.users.created++;
        } else {
          results.users.skipped++;
        }
      }
    }

    // Restore products
    if (data.data.products && data.data.products.length > 0) {
      for (const product of data.data.products) {
        // Check if user exists
        const userExists = await prisma.user.findUnique({
          where: { id: product.userId },
        });

        if (!userExists) {
          results.products.skipped++;
          continue;
        }

        const existing = await prisma.product.findUnique({
          where: { id: product.id },
        });

        if (existing && mode === "merge") {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: product.name,
              barcode: product.barcode,
              expiryDate: new Date(product.expiryDate),
              status: product.status ?? "ACTIVE",
              isExpired: product.isExpired ?? false,
              quantity: product.quantity,
            },
          });
          results.products.updated++;
        } else if (!existing) {
          await prisma.product.create({
            data: {
              id: product.id,
              name: product.name,
              barcode: product.barcode,
              expiryDate: new Date(product.expiryDate),
              status: product.status ?? "ACTIVE",
              isExpired: product.isExpired ?? false,
              quantity: product.quantity,
              userId: product.userId,
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

    // Restore settings
    if (data.data.settings && data.data.settings.length > 0) {
      for (const settings of data.data.settings) {
        // Check if user exists
        const userExists = await prisma.user.findUnique({
          where: { id: settings.userId },
        });

        if (!userExists) {
          results.settings.skipped++;
          continue;
        }

        const existing = await prisma.settings.findUnique({
          where: { userId: settings.userId },
        });

        if (existing && mode === "merge") {
          await prisma.settings.update({
            where: { userId: settings.userId },
            data: {
              telegramNotifications: settings.telegramNotifications ?? existing.telegramNotifications,
              emailNotifications: settings.emailNotifications ?? existing.emailNotifications,
              urgentThreshold: settings.urgentThreshold ?? existing.urgentThreshold,
              warningThreshold: settings.warningThreshold ?? existing.warningThreshold,
              theme: settings.theme ?? existing.theme,
            },
          });
          results.settings.updated++;
        } else if (!existing) {
          await prisma.settings.create({
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
              notifyBeforeExpiration: settings.notifyBeforeExpiration ?? 3,
              urgentThreshold: settings.urgentThreshold ?? 3,
              warningThreshold: settings.warningThreshold ?? 7,
              urgentNotifyTime: settings.urgentNotifyTime ?? "10:00",
              warningNotifyTime: settings.warningNotifyTime ?? "10:00",
              theme: settings.theme ?? "light",
            },
          });
          results.settings.created++;
        } else {
          results.settings.skipped++;
        }
      }
    }

    await prisma.systemLog.create({
      data: {
        level: "INFO",
        message: `Admin ${session.user.email} imported database backup (${mode} mode)`,
        meta: JSON.stringify({ adminId: session.user.id, mode, results }),
      },
    });

    res.status(200).json({
      success: true,
      mode,
      results,
    });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
