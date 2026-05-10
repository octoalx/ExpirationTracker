import { differenceInDays, startOfDay } from "date-fns";
import { prisma } from "../lib/prisma";
import { emailService } from "./emailService";
import { getEmailTemplate } from "../lib/email-templates/index";
import type { ExpirationProduct } from "../lib/email-templates/index";

type UrgencyLevel = "EXPIRED" | "URGENT" | "WARNING" | "SAFE";

/** Maps days-until-expiry to an urgency level based on user thresholds. */
function getUrgencyLevel(daysUntil: number, urgentThreshold: number, warningThreshold: number): UrgencyLevel {
  if (daysUntil < 0) return "EXPIRED";
  if (daysUntil <= urgentThreshold) return "URGENT";
  if (daysUntil <= warningThreshold) return "WARNING";
  return "SAFE";
}

/** Converts internal `UrgencyLevel` to the email template's urgency enum. */
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

/** Initializes SMTP for the given user and sends an expiration summary email. */
async function sendEmailForProducts(
  user: { id: string; name: string | null; email: string | null },
  settings: {
    notificationEmail: string | null;
    smtpHost: string;
    smtpPort: number | null;
    smtpUser: string;
    smtpPass: string;
  },
  products: ExpirationProduct[],
): Promise<SendResult> {
  const recipientEmail = settings.notificationEmail || user.email;
  if (!recipientEmail) {
    return { userId: user.id, email: "", success: false, productsCount: 0, error: "No recipient email" };
  }

  emailService.initialize({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    user: settings.smtpUser,
    pass: settings.smtpPass,
    from: settings.smtpUser,
  });

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const { html } = getEmailTemplate(
    "summary",
    { userName: user.name || "", products, appUrl },
    "auto",
    recipientEmail
  );

  const result = await emailService.send(
    recipientEmail,
    `⏰ ${products.length} товаров требуют внимания`,
    html,
    user.id
  );

  if (result.success) {
    console.log(`[Notifications] Sent to ${recipientEmail} for ${products.length} products`);
  } else {
    console.error(`[Notifications] Failed to send to ${recipientEmail}: ${result.error}`);
  }

  return {
    userId: user.id,
    email: recipientEmail,
    success: result.success,
    productsCount: products.length,
    error: result.error,
  };
}

/**
 * Daily urgent report — products at or below the urgent threshold.
 * Sends every day for each user with email notifications enabled.
 */
export async function sendDailyUrgentNotifications(userId?: string): Promise<SendResult[]> {
  const results: SendResult[] = [];

  const users = await prisma.user.findMany({
    where: userId ? { id: userId } : { settings: { emailNotifications: true } },
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
      products: { where: { status: "ACTIVE" } },
    },
  });

  for (const user of users) {
    if (!user.settings?.emailNotifications) continue;
    if (!user.settings.smtpHost || !user.settings.smtpUser || !user.settings.smtpPass) {
      console.warn(`[Notifications/Daily] SMTP not configured for user ${user.id}`);
      continue;
    }

    const urgentThreshold = user.settings.urgentThreshold ?? 3;
    const warningThreshold = user.settings.warningThreshold ?? 7;
    const today = startOfDay(new Date());

    const urgentProducts = user.products
      .filter((p) => {
        if (!p.expiryDate) return false;
        const daysUntil = differenceInDays(startOfDay(new Date(p.expiryDate)), today);
        return daysUntil <= urgentThreshold;
      })
      .map((p) => {
        const daysUntil = differenceInDays(startOfDay(new Date(p.expiryDate!)), today);
        return {
          name: p.name,
          barcode: p.barcode,
          expiryDate: p.expiryDate!.toISOString(),
          daysUntil,
          urgency: mapUrgency(getUrgencyLevel(daysUntil, urgentThreshold, warningThreshold)),
        } as ExpirationProduct;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (urgentProducts.length === 0) continue;

    const result = await sendEmailForProducts(
      user,
      user.settings as { notificationEmail: string | null; smtpHost: string; smtpPort: number | null; smtpUser: string; smtpPass: string },
      urgentProducts
    );
    results.push(result);
  }

  return results;
}

/**
 * Warning notification — products that are exactly `warningThreshold` days from expiry.
 * Fires daily; no-op if no matching products exist.
 */
export async function sendWarningNotifications(userId?: string): Promise<SendResult[]> {
  const results: SendResult[] = [];

  const users = await prisma.user.findMany({
    where: userId ? { id: userId } : { settings: { emailNotifications: true } },
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
      products: { where: { status: "ACTIVE" } },
    },
  });

  for (const user of users) {
    if (!user.settings?.emailNotifications) continue;
    if (!user.settings.smtpHost || !user.settings.smtpUser || !user.settings.smtpPass) {
      console.warn(`[Notifications/Warning] SMTP not configured for user ${user.id}`);
      continue;
    }

    const warningThreshold = user.settings.warningThreshold ?? 7;
    const today = startOfDay(new Date());

    const warningProducts = user.products
      .filter((p) => {
        if (!p.expiryDate) return false;
        const daysUntil = differenceInDays(startOfDay(new Date(p.expiryDate)), today);
        return daysUntil === warningThreshold;
      })
      .map((p) => ({
        name: p.name,
        barcode: p.barcode,
        expiryDate: p.expiryDate!.toISOString(),
        daysUntil: warningThreshold,
        urgency: "warning" as const,
      }));

    if (warningProducts.length === 0) continue;

    const result = await sendEmailForProducts(
      user,
      user.settings as { notificationEmail: string | null; smtpHost: string; smtpPort: number | null; smtpUser: string; smtpPass: string },
      warningProducts
    );
    results.push(result);
  }

  return results;
}

/**
 * Backward-compatible entry point — used by manual API triggers.
 * Sends both urgent and warning notifications.
 */
export async function sendExpirationNotifications(userId?: string): Promise<SendResult[]> {
  const [dailyResults, warningResults] = await Promise.all([
    sendDailyUrgentNotifications(userId),
    sendWarningNotifications(userId),
  ]);
  return [...dailyResults, ...warningResults];
}
