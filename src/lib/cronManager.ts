import cron from "node-cron";
import { sendExpirationNotifications } from "../services/notificationService";
import { prisma } from "./prisma";

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

// Schedule to run every day at 10:00 AM
const scheduledTask = cron.schedule(
  "0 10 * * *",
  () => {
    console.log("Running scheduled tasks...");
    // Update expired products
    updateExpiredProducts().catch((err) => {
      console.error("Error during expired products update:", err);
    });
    // Send notifications
    sendExpirationNotifications().catch((err) => {
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
