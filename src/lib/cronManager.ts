import cron from "node-cron";
import { sendDailyUrgentNotifications, sendWarningNotifications } from "../services/notificationService";
import { prisma } from "./prisma";
import { createBackup } from "./backupService";
import { logger } from "./logger";
import { minskDate } from "./expiry-calendar";
import { tickTelegram } from "./server/telegram-runtime";

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
    const now = new Date(`${minskDate()}T00:00:00.000Z`);
    const result = await prisma.product.updateMany({
      where: { status: "ACTIVE", deletedAt: null, expiryDate: { lt: now }, isExpired: false },
      data: { isExpired: true },
    });
    if (result.count > 0) logger.info(`Updated ${result.count} expired products`, { context: "Cron" });
  } catch (err) {
    logger.error("[Cron] Error updating expired products", { error: String(err) });
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
      logger.info(`Urgent notify time matched (${nowTime})`, { context: "Cron", userId: s.userId });
      sendDailyUrgentNotifications(s.userId).catch((e) =>
        logger.error("[Cron] Error sending urgent notifications", { userId: s.userId, error: String(e) })
      );
    }
    if (s.warningNotifyTime === nowTime) {
      logger.info(`Warning notify time matched (${nowTime})`, { context: "Cron", userId: s.userId });
      sendWarningNotifications(s.userId).catch((e) =>
        logger.error("[Cron] Error sending warning notifications", { userId: s.userId, error: String(e) })
      );
    }
  }
}

/** Max age of SystemLog entries to retain (days). */
const LOG_RETENTION_DAYS = 30;
/** Max total SystemLog rows to retain. */
const LOG_MAX_ROWS = 5000;

/** Deletes SystemLog entries older than LOG_RETENTION_DAYS and trims to LOG_MAX_ROWS. */
async function pruneOldLogs() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOG_RETENTION_DAYS);

    const deleted = await prisma.systemLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    const total = await prisma.systemLog.count();
    if (total > LOG_MAX_ROWS) {
      const oldest = await prisma.systemLog.findMany({
        orderBy: { timestamp: "asc" },
        take: total - LOG_MAX_ROWS,
        select: { id: true },
      });
      await prisma.systemLog.deleteMany({
        where: { id: { in: oldest.map((r) => r.id) } },
      });
      logger.info(`Pruned ${oldest.length} excess log rows (cap: ${LOG_MAX_ROWS})`, { context: "Cron" });
    }

    if (deleted.count > 0) {
      logger.info(`Pruned ${deleted.count} log entries older than ${LOG_RETENTION_DAYS} days`, { context: "Cron" });
    }
  } catch (err) {
    logger.error("[Cron] Error pruning old logs", { error: String(err) });
  }
}

/** Tracks the last date log pruning was executed. */
let lastPruneDate: string | null = null;

/** Runs daily log pruning once per day. */
async function runScheduledLogPrune() {
  const today = new Date().toISOString().split("T")[0];
  if (lastPruneDate === today) return;
  lastPruneDate = today;
  await pruneOldLogs();
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
      logger.info(`Backup time matched (${nowTime})`, { context: "Cron" });
      const backupName = await createBackup();
      if (backupName) {
        logger.info("[Cron] Scheduled backup created", { file: backupName });
      } else {
        logger.error("[Cron] Scheduled backup failed");
      }
      lastBackupDate = today;
      break;
    }
  }
}


/** Runs every minute: checks expired products, sends notifications, triggers backups. */
const minuteTask = cron.schedule(
  "* * * * *",
  () => {
    void tickTelegram(true);
    updateExpiredProducts().catch((e) => logger.error("[Cron] Error", { error: String(e) }));
    runScheduledNotifications().catch((e) => logger.error("[Cron] Error", { error: String(e) }));
    runScheduledBackup().catch((e) => logger.error("[Cron] Backup error", { error: String(e) }));
    runScheduledLogPrune().catch((e) => logger.error("[Cron] Log prune error", { error: String(e) }));
  },
  { scheduled: false, timezone: TIMEZONE },
);

/** Starts all scheduled background jobs. */
export function startCronJobs() {
  console.log("[Cron] Starting cron jobs (timezone: " + TIMEZONE + ")...");
  minuteTask.start();
  const state = globalThis as typeof globalThis & { telegramTimer?: ReturnType<typeof setInterval> };
  if (!state.telegramTimer) {
    state.telegramTimer = setInterval(() => { void tickTelegram(); }, 10000);
    state.telegramTimer.unref();
  }
}
