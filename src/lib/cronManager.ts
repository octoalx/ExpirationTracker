import cron from "node-cron";
import { checkAndSendEmails } from "./notificationService";

// Schedule to run every day at 10:00 AM
const scheduledTask = cron.schedule(
  "0 10 * * *",
  () => {
    console.log("Running scheduled task: checkAndSendEmails");
    checkAndSendEmails().catch((err) => {
      console.error("Error during scheduled email check:", err);
    });
  },
  {
    scheduled: false, // Don't start immediately
    timezone: "Europe/Moscow", // User's timezone
  },
);

export function startCronJobs() {
  console.log("Starting cron jobs...");
  scheduledTask.start();
}
