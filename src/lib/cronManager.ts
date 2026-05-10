import cron from "node-cron";
import { sendDailyUrgentNotifications, sendWarningNotifications } from "../services/notificationService";
import { prisma } from "./prisma";
import { createBackup } from "./backupService";

/** Timezone used for all scheduled tasks. */
const TIMEZONE = "Europe/Minsk";

/** Returns current time in Minsk timezone as `HH:mm`. */
function currentTimeMinsk(): string {
  return new Date().toLocaleTimeString("ru-RU", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Marks active products past their expiry date as expired. */
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

/** Sends email notifications when current time matches user-configured notify times. */
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

/** Tracks the last date a backup was executed to prevent duplicates within a day. */
let lastBackupDate: string | null = null;

/** Runs a database backup when current time matches any user's configured backup time (once per day). */
async function runScheduledBackup() {
  const nowTime = currentTimeMinsk();
  const today = new Date().toISOString().split("T")[0];

  if (lastBackupDate === today) return;

  const settings = await prisma.settings.findMany({
    where: { backupEnabled: true },
    select: { backupTime: true },
  });

  for (const s of settings) {
    if (s.backupTime === nowTime) {
      console.log(`[Cron] Backup time matched (${nowTime})`);
      createBackup();
      lastBackupDate = today;
      break;
    }
  }
}


/** Runs every minute: checks expired products, sends notifications, triggers backups. */
const minuteTask = cron.schedule(
  "* * * * *",
  () => {
    updateExpiredProducts().catch((e) => console.error("[Cron] Error:", e));
    runScheduledNotifications().catch((e) => console.error("[Cron] Error:", e));
    runScheduledBackup().catch((e) => console.error("[Cron] Backup error:", e));
  },
  { scheduled: false, timezone: TIMEZONE },
);

/** Starts all scheduled background jobs. */
export function startCronJobs() {
  console.log("[Cron] Starting cron jobs (timezone: " + TIMEZONE + ")...");
  minuteTask.start();
}
