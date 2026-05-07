import "dotenv/config";
import { sendDailyUrgentNotifications, sendWarningNotifications } from "../src/services/notificationService";

async function main() {
  console.log("[Cron] Running daily notifications at 10:00 Minsk...");

  await sendDailyUrgentNotifications();
  await sendWarningNotifications();

  console.log("[Cron] Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
