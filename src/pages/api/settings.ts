import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { apiErrorHandler } from "../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";

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
              // smtpPass intentionally excluded for security
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

      res.status(200).json({
        user: {
          name: userWithSettings.name,
          email: userWithSettings.email,
        },
        settings,
      });
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else if (req.method === "POST") {
    try {
      const { user: userData, settings: settingsData } = req.body;

      // 1. Strip non-allowed fields from user data
      const { id: _i, ...cleanUserData } = userData;

      // 2. Strip non-allowed fields from settings data
      const {
        notificationEmail,
        id: _si,
        userId: _ui,
        ...cleanSettingsData
      } = settingsData;

      // 3. Persist changes
      await prisma.$transaction([
        // Update allowed User fields (name, email)
        prisma.user.update({
          where: { id: session.user.id },
          data: {
            name: cleanUserData.name,
            email: cleanUserData.email,
          },
        }),
        // Update Settings
        prisma.settings.update({
          where: { userId: session.user.id },
          data: { ...cleanSettingsData, notificationEmail },
        }),
      ]);

      res.status(200).json({ success: true });
    } catch (error) {
      apiErrorHandler(error, res);
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
