import cron from "node-cron";
import { sendDailyUrgentNotifications, sendWarningNotifications } from "../services/notificationService";
import { prisma } from "./prisma";

const TIMEZONE = "Europe/Minsk";

function currentTimeMinsk(): string {
  return new Date().toLocaleTimeString("ru-RU", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function updateExpiredProducts() {
  try {
    const now = new Date();
    const result = await prisma.product.updateMany({
      where: { status: "ACTIVE", expiryDate: { lt: now }, isExpired: false },
      data: { isExpired: true },
    });
    if (result.count > 0) console.log(`[Cron] Updated ${result.count} expired products`);
  } catch (err) {
    console.error("[Cron] Error updating expired products:", err);
  }
}

async function runScheduledNotifications() {
  const nowTime = currentTimeMinsk();

  const users = await prisma.settings.findMany({
    where: { emailNotifications: true },
    select: { userId: true, urgentNotifyTime: true, warningNotifyTime: true },
  });

  for (const s of users) {
    if (s.urgentNotifyTime === nowTime) {
      console.log(`[Cron] Urgent notify time matched (${nowTime}) for user ${s.userId}`);
      sendDailyUrgentNotifications(s.userId).catch((e) =>
        console.error("[Cron] Error sending urgent notifications:", e)
      );
    }
    if (s.warningNotifyTime === nowTime) {
      console.log(`[Cron] Warning notify time matched (${nowTime}) for user ${s.userId}`);
      sendWarningNotifications(s.userId).catch((e) =>
        console.error("[Cron] Error sending warning notifications:", e)
      );
    }
  }
}

// Каждую минуту проверяем время и обновляем просроченные
const minuteTask = cron.schedule(
  "* * * * *",
  () => {
    updateExpiredProducts().catch((e) => console.error("[Cron] Error:", e));
    runScheduledNotifications().catch((e) => console.error("[Cron] Error:", e));
  },
  { scheduled: false, timezone: TIMEZONE },
);

export function startCronJobs() {
  console.log("[Cron] Starting cron jobs (timezone: " + TIMEZONE + ")...");
  minuteTask.start();
}
