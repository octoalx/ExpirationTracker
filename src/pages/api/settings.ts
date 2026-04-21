import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { apiErrorHandler } from "../../lib/apiErrorHandler";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";

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
          settings: true,
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

      // 1. Очищаем объект userData от лишних полей
      const { id: _i, ...cleanUserData } = userData;

      // 2. Очищаем объект settingsData
      const {
        notificationEmail,
        id: _si,
        userId: _ui,
        ...cleanSettingsData
      } = settingsData;

      // 3. Выполняем обновление
      await prisma.$transaction([
        // Обновляем только разрешенные поля User (name, email)
        prisma.user.update({
          where: { id: session.user.id },
          data: {
            name: cleanUserData.name,
            email: cleanUserData.email,
          },
        }),
        // Обновляем Settings
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
