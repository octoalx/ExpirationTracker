import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { emailService } from "../../../services/emailService";
import { renderTestEmail } from "../../../lib/email-templates/index";

/** POST: send a test email to verify the user's SMTP configuration. */
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
    const settings = await prisma.settings.findUnique({
      where: { userId: session.user.id },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        notificationEmail: true,
        emailNotifications: true,
      },
    });

    if (!settings?.emailNotifications) {
      return res.status(400).json({
        success: false,
        message: "Email notifications not enabled",
      });
    }

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      return res.status(400).json({
        success: false,
        message: "SMTP not configured",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });

    const recipientEmail = settings.notificationEmail || user?.email;
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "No recipient email configured",
      });
    }

    emailService.initialize({
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      user: settings.smtpUser,
      pass: settings.smtpPass,
      from: settings.smtpUser,
    });

    const html = renderTestEmail(user?.name || "");
    const result = await emailService.send(
      recipientEmail,
      "📧 Тестовое письмо от ExpiTrack",
      html,
      session.user.id
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Test email sent to ${recipientEmail}`,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to send test email",
      });
    }
  } catch (error) {
    console.error("[API] Test email error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
