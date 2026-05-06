import cron from "node-cron";
import { sendDailyUrgentNotifications, sendWarningNotifications } from "../services/notificationService";
import { prisma } from "./prisma";

const TIMEZONE = "Europe/Minsk";

// Update expired products flag
async function updateExpiredProducts() {
  try {
    const now = new Date();
    const result = await prisma.product.updateMany({
      where: {
        status: "ACTIVE",
        expiryDate: { lt: now },
        isExpired: false,
      },
      data: { isExpired: true },
    });
    console.log(`[Cron] Updated ${result.count} expired products`);
  } catch (err) {
    console.error("[Cron] Error updating expired products:", err);
  }
}

// Ежедневно в 10:00 по Минску:
// 1. Срочные товары (≤ urgentThreshold) — каждый день
// 2. Внимание (urgentThreshold < days ≤ warningThreshold) — один раз на товар
const dailyTask = cron.schedule(
  "0 10 * * *",
  () => {
    console.log("[Cron] Running daily notifications at 10:00 Minsk...");
    updateExpiredProducts().catch((err) => {
      console.error("[Cron] Error updating expired products:", err);
    });
    sendDailyUrgentNotifications().catch((err) => {
      console.error("[Cron] Error sending daily urgent notifications:", err);
    });
    sendWarningNotifications().catch((err) => {
      console.error("[Cron] Error sending warning notifications:", err);
    });
  },
  {
    scheduled: false,
    timezone: TIMEZONE,
  },
);

export function startCronJobs() {
  console.log("[Cron] Starting cron jobs (timezone: " + TIMEZONE + ")...");
  dailyTask.start();
}
