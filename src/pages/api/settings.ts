import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { apiErrorHandler } from "../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { logger } from "../../lib/logger";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { inventoryScope } from "@/lib/server/inventory";

const settingsSchema = z.object({
  urgentThreshold: z.number().int().nonnegative().optional(),
  warningThreshold: z.number().int().nonnegative().optional(),
  telegramNotifications: z.boolean().optional(), emailNotifications: z.boolean().optional(),
  notificationEmail: z.string().trim().nullable().optional(),
  smtpHost: z.string().nullable().optional(), smtpPort: z.number().int().nullable().optional(),
  smtpUser: z.string().nullable().optional(), smtpPass: z.string().optional(),
  urgentNotifyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  warningNotifyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});
const requestSchema = z.object({
  user: z.object({ name: z.string().trim().min(1).max(100).optional(), email: z.string().trim().email().max(254).optional() }).optional(),
  settings: settingsSchema.optional(),
  currentPassword: z.string().optional(), newPassword: z.string().optional(),
}).refine(data => Object.keys(data.user ?? {}).length > 0 || Object.keys(data.settings ?? {}).length > 0 || !!data.newPassword);

/** GET: fetch user settings | POST: update only supplied profile/settings fields. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = session.user.id;
  const { membership } = await inventoryScope(prisma, userId);

  if (req.method === "GET") {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      if (req.query.scope === "thresholds") {
        const settings = await prisma.settings.findUnique({
          where: { userId }, select: { urgentThreshold: true, warningThreshold: true },
        });
        return res.status(200).json({ settings: membership?.store ?? settings ?? { urgentThreshold: 3, warningThreshold: 7 } });
      }
      const userWithSettings = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          settings: {
            select: {
              id: true,
              userId: true,
              telegramToken: true,
              telegramChatId: true,
              telegramNotifications: true,
              notificationEmail: true,
              emailNotifications: true,
              smtpHost: true,
              smtpPort: true,
              smtpUser: true,
              smtpPass: true, // fetched only to derive hasSmtpPass flag
              urgentThreshold: true,
              warningThreshold: true,
              urgentNotifyTime: true,
              warningNotifyTime: true,
              backupTime: true,
              backupEnabled: true,
            },
          },
        },
      });

      if (!userWithSettings) {
        return res.status(404).json({ message: "User not found" });
      }

      let settings = userWithSettings.settings;
      if (!settings) {
        settings = await prisma.settings.create({
          data: { userId },
        });
      }

      // Never send the actual password to the client
      const { smtpPass, telegramToken, telegramChatId, ...safeSettings } = settings;

      res.status(200).json({
        user: {
          name: userWithSettings.name,
          email: userWithSettings.email,
        },
        settings: { ...safeSettings, hasSmtpPass: !!smtpPass,
          ...(membership ? { urgentThreshold: membership.store.urgentThreshold, warningThreshold: membership.store.warningThreshold } : {}) },
        store: membership?.store ?? null, storeRole: membership?.role ?? null,
      });
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success) {
        const messages: Record<string, string> = {
          "user.name": "Укажите имя в разделе «Личные данные» (от 1 до 100 символов).",
          "user.email": "Укажите корректный email для входа в разделе «Личные данные».",
          "settings.notificationEmail": "Укажите корректный email для уведомлений во вкладке «Интеграции» или оставьте его пустым.",
          "settings.smtpPort": "Укажите SMTP Port от 1 до 65535 во вкладке «Интеграции».",
          "settings.urgentThreshold": "Укажите целое неотрицательное число дней для «Срочно» во вкладке «Статусы».",
          "settings.warningThreshold": "Укажите целое неотрицательное число дней для «Внимание» во вкладке «Статусы».",
          "settings.urgentNotifyTime": "Укажите время отчёта «Срочно» во вкладке «Интеграции» в формате ЧЧ:ММ.",
          "settings.warningNotifyTime": "Укажите время предупреждения «Внимание» во вкладке «Интеграции» в формате ЧЧ:ММ.",
        };
        // Return field names only; validation input may contain credentials.
        const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join(".")))];
        return res.status(400).json({
          message: fields.map(field => messages[field] ?? "Проверьте значения настроек.").join(" "),
          fields,
        });
      }
      const { user: userData = {}, settings: settingsData = {}, currentPassword, newPassword } = parsed.data;
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!currentUser) return res.status(404).json({ message: "Пользователь не найден." });
      const storedSettings = await prisma.settings.findUnique({ where: { userId } });
      const changesThresholds = settingsData.urgentThreshold !== undefined || settingsData.warningThreshold !== undefined;
      const urgentThreshold = settingsData.urgentThreshold ?? membership?.store.urgentThreshold ?? storedSettings?.urgentThreshold ?? 3;
      const warningThreshold = settingsData.warningThreshold ?? membership?.store.warningThreshold ?? storedSettings?.warningThreshold ?? 7;
      if (membership && changesThresholds && (urgentThreshold !== membership.store.urgentThreshold || warningThreshold !== membership.store.warningThreshold)) {
        return res.status(403).json({ message: "Пороги магазина меняются руководителем в разделе «Команда»." });
      }
      if (changesThresholds && (!Number.isSafeInteger(urgentThreshold) || !Number.isSafeInteger(warningThreshold) ||
          urgentThreshold < 0 || warningThreshold < urgentThreshold)) {
        return res.status(400).json({ message: "Пороги должны быть целыми неотрицательными числами. «Внимание» должно быть не меньше «Срочно»." });
      }

      const emailEnabled = settingsData.emailNotifications ?? storedSettings?.emailNotifications ?? false;
      const enablingEmail = settingsData.emailNotifications === true && !storedSettings?.emailNotifications;
      if (emailEnabled) {
        const recipient = settingsData.notificationEmail !== undefined ? settingsData.notificationEmail : storedSettings?.notificationEmail;
        if ((enablingEmail || settingsData.notificationEmail !== undefined) && recipient && !z.string().email().safeParse(recipient).success) {
          return res.status(400).json({ message: "Укажите корректный email для уведомлений во вкладке «Интеграции» или оставьте его пустым.", fields: ["settings.notificationEmail"] });
        }
        const port = settingsData.smtpPort !== undefined ? settingsData.smtpPort : storedSettings?.smtpPort;
        if ((enablingEmail || settingsData.smtpPort !== undefined) && port != null && (port < 1 || port > 65535)) {
          return res.status(400).json({ message: "Укажите SMTP Port от 1 до 65535 во вкладке «Интеграции».", fields: ["settings.smtpPort"] });
        }
      }
      if (newPassword && (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72)) {
        return res.status(400).json({ message: "Новый пароль должен содержать минимум 8 символов и не более 72 байт UTF-8." });
      }
      if ((userData.email !== undefined && userData.email !== currentUser.email) || newPassword) {
        if (!currentPassword || !currentUser.password || !(await bcrypt.compare(currentPassword, currentUser.password))) {
          return res.status(400).json({ message: "Для смены email или пароля введите верный текущий пароль." });
        }
      }
      const password = newPassword ? await bcrypt.hash(newPassword, 10) : undefined;
      const { smtpPass, ...cleanSettingsData } = settingsData;

      // Only update smtpPass if user actually provided a new value
      const settingsUpdate = { ...cleanSettingsData, ...(smtpPass ? { smtpPass } : {}) };

      // 3. Persist changes
      await prisma.$transaction([
        // Update allowed User fields (name, email)
        ...(Object.keys(userData).length || password ? [prisma.user.update({
          where: { id: session.user.id },
          data: {
            name: userData.name,
            email: userData.email,
            ...(password ? { password } : {}),
          },
        })] : []),
        // Update Settings
        ...(Object.keys(settingsUpdate).length ? [prisma.settings.upsert({
          where: { userId: session.user.id },
          update: settingsUpdate,
          create: { userId, ...settingsUpdate },
        })] : []),
      ]);

      logger.info("User updated settings", { userId });
      res.status(200).json({ success: true });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return res.status(409).json({ message: "Этот email уже используется." });
      }
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
