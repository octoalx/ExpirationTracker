import { prisma } from "../lib/prisma";
import { emailService } from "./emailService";
import { getEmailTemplate } from "../lib/email-templates/index";
import type { ExpirationProduct } from "../lib/email-templates/index";

type UrgencyLevel = "EXPIRED" | "URGENT" | "WARNING" | "SAFE";

function getUrgencyLevel(daysUntil: number, urgentThreshold: number, warningThreshold: number): UrgencyLevel {
  if (daysUntil < 0) return "EXPIRED";
  if (daysUntil <= urgentThreshold) return "URGENT";
  if (daysUntil <= warningThreshold) return "WARNING";
  return "SAFE";
}

function mapUrgency(level: UrgencyLevel): ExpirationProduct["urgency"] {
  switch (level) {
    case "EXPIRED": return "expired";
    case "URGENT": return "critical";
    case "WARNING": return "warning";
    case "SAFE": return "soon";
  }
}

interface SendResult {
  userId: string;
  email: string;
  success: boolean;
  productsCount: number;
  error?: string;
}

export async function sendExpirationNotifications(userId?: string): Promise<SendResult[]> {
  const results: SendResult[] = [];

  const users = await prisma.user.findMany({
    where: userId ? { id: userId } : {
      settings: {
        emailNotifications: true,
      },
    },
    include: {
      settings: {
        select: {
          notificationEmail: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          urgentThreshold: true,
          warningThreshold: true,
          emailNotifications: true,
        },
      },
      products: {
        where: {
          status: "ACTIVE",
        },
      },
    },
  });

  for (const user of users) {
    if (!user.settings?.emailNotifications) {
      continue;
    }

    if (!user.settings.smtpHost || !user.settings.smtpUser || !user.settings.smtpPass) {
      console.warn(`[Notifications] SMTP not configured for user ${user.id}`);
      continue;
    }

    const urgentThreshold = user.settings.urgentThreshold ?? 3;
    const warningThreshold = user.settings.warningThreshold ?? 7;

    const expiringProducts = user.products
      .filter((p) => {
        if (!p.expiryDate) return false;
        const daysUntil = Math.ceil(
          (new Date(p.expiryDate).getTime() - new Date().getTime()) /
          (1000 * 3600 * 24)
        );
        return daysUntil <= warningThreshold;
      })
      .map((p) => {
        const daysUntil = Math.ceil(
          (new Date(p.expiryDate!).getTime() - new Date().getTime()) /
          (1000 * 3600 * 24)
        );
        return {
          name: p.name,
          barcode: p.barcode,
          expiryDate: p.expiryDate!.toISOString(),
          daysUntil,
          urgency: mapUrgency(getUrgencyLevel(daysUntil, urgentThreshold, warningThreshold)),
        } as ExpirationProduct;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (expiringProducts.length === 0) {
      continue;
    }

    const recipientEmail = user.settings.notificationEmail || user.email;
    if (!recipientEmail) {
      continue;
    }

    emailService.initialize({
      host: user.settings.smtpHost,
      port: user.settings.smtpPort ?? 587,
      user: user.settings.smtpUser,
      pass: user.settings.smtpPass,
      from: user.settings.smtpUser,
    });

    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
    const { html } = getEmailTemplate(
      "summary",
      { userName: user.name || "", products: expiringProducts, appUrl },
      "auto",
      recipientEmail
    );

    const result = await emailService.send(
      recipientEmail,
      `⏰ ${expiringProducts.length} товаров требуют внимания`,
      html,
      user.id
    );

    results.push({
      userId: user.id,
      email: recipientEmail,
      success: result.success,
      productsCount: expiringProducts.length,
      error: result.error,
    });

    if (result.success) {
      console.log(
        `[Notifications] Sent to ${recipientEmail} for ${expiringProducts.length} products`
      );
    } else {
      console.error(
        `[Notifications] Failed to send to ${recipientEmail}: ${result.error}`
      );
    }
  }

  return results;
}
