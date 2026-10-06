import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { apiErrorHandler } from "../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { logger } from "../../lib/logger";
import bcrypt from "bcryptjs";
import { z } from "zod";

const settingsSchema = z.object({
  urgentThreshold: z.number().int().nonnegative(),
  warningThreshold: z.number().int().nonnegative(),
  telegramNotifications: z.boolean().optional(), emailNotifications: z.boolean().optional(),
  telegramToken: z.string().nullable().optional(), telegramChatId: z.string().nullable().optional(),
  notificationEmail: z.union([z.literal(""), z.string().email()]).nullable().optional(),
  smtpHost: z.string().nullable().optional(), smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpUser: z.string().nullable().optional(), smtpPass: z.string().optional(),
  urgentNotifyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  warningNotifyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});
const requestSchema = z.object({
  user: z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().email().max(254) }),
  settings: settingsSchema,
  currentPassword: z.string().optional(), newPassword: z.string().optional(),
});

/** GET: fetch user settings | POST: update user profile and settings. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      if (req.query.scope === "thresholds") {
        const settings = await prisma.settings.findUnique({
          where: { userId }, select: { urgentThreshold: true, warningThreshold: true },
        });
        return res.status(200).json({ settings: settings ?? { urgentThreshold: 3, warningThreshold: 7 } });
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
      const { smtpPass, ...safeSettings } = settings;

      res.status(200).json({
        user: {
          name: userWithSettings.name,
          email: userWithSettings.email,
        },
        settings: { ...safeSettings, hasSmtpPass: !!smtpPass },
      });
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Проверьте имя, email и значения настроек." });
      const { user: userData, settings: settingsData, currentPassword, newPassword } = parsed.data;
      const { urgentThreshold, warningThreshold } = settingsData;
      if (!Number.isSafeInteger(urgentThreshold) || !Number.isSafeInteger(warningThreshold) ||
          urgentThreshold < 0 || warningThreshold < urgentThreshold) {
        return res.status(400).json({ message: "Пороги должны быть целыми неотрицательными числами. «Внимание» должно быть не меньше «Срочно»." });
      }

      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!currentUser) return res.status(404).json({ message: "Пользователь не найден." });
      if (newPassword && (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72)) {
        return res.status(400).json({ message: "Новый пароль должен содержать минимум 8 символов и не более 72 байт UTF-8." });
      }
      if (userData.email !== currentUser.email || newPassword) {
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
        prisma.user.update({
          where: { id: session.user.id },
          data: {
            name: userData.name,
            email: userData.email,
            ...(password ? { password } : {}),
          },
        }),
        // Update Settings
        prisma.settings.upsert({
          where: { userId: session.user.id },
          update: settingsUpdate,
          create: { userId, ...settingsUpdate },
        }),
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
