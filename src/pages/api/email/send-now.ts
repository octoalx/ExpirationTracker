import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { sendExpirationNotifications } from "../../../services/notificationService";

/** POST: manually trigger expiration notifications for the current user. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const results = await sendExpirationNotifications(session.user.id);
    return res.status(200).json({
      success: true,
      results,
      message: results.length > 0
        ? `Отправлено ${results.length} уведомлений`
        : "Нет товаров, требующих уведомления",
    });
  } catch (error) {
    console.error("[API] Send now error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
