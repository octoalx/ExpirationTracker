import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { Telegraf } from 'telegraf';

const prisma = new PrismaClient();

// Function to send email notifications
async function sendEmailNotification(user: any, product: any) {
  if (!user.smtpHost || !user.smtpPort || !user.smtpUser || !user.smtpPass) {
    console.log(`SMTP settings missing for user ${user.id}. Skipping email.`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: user.smtpHost,
    port: user.smtpPort,
    secure: user.smtpPort === 465, // Use TLS if port is 465
    auth: {
      user: user.smtpUser,
      pass: user.smtpPass,
    },
  });

  const mailOptions = {
    from: `"Expiration Tracker" <${user.smtpUser}>`,
    to: user.email, // Assuming user has an email field, though not specified in schema. Will add it to plan.
    subject: `Product Expiring Soon: ${product.name}`,
    html: `
      <p>Hello,</p>
      <p>The product <strong>${product.name}</strong> is expiring soon.</p>
      <p>Expiration Date: ${new Date(product.expirationDate).toLocaleDateString()}</p>
      <p>Please take necessary action.</p>
      <p>Thank you,<br>Expiration Tracker Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email notification sent to ${user.email} for product ${product.name}`);
  } catch (error) {
    console.error(`Error sending email to ${user.email} for product ${product.name}:`, error);
  }
}

// Function to send Telegram notifications
async function sendTelegramNotification(user: any, product: any) {
  if (!user.telegramChatId) {
    console.log(`Telegram Chat ID missing for user ${user.id}. Skipping Telegram.`);
    return;
  }

  // Assuming Telegraf is configured with a bot token, which is not yet defined.
  // For now, we'll use a placeholder or fetch API if internet is available.
  // A bot token would typically be stored in environment variables.
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Placeholder for bot token

  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram notifications will not work.');
    // Fallback to fetch API if bot token is missing, assuming direct API access is possible
    // This is a simplified example and might require more robust error handling and API key management.
    try {
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: user.telegramChatId,
          text: `Product Expiring Soon: ${product.name}\nExpiration Date: ${new Date(product.expirationDate).toLocaleDateString()}`,
        }),
      });
      if (!response.ok) {
        console.error(`Telegram API error: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Telegram notification sent to chat ID ${user.telegramChatId} for product ${product.name}`);
      }
    } catch (error) {
      console.error(`Error sending Telegram notification via fetch for user ${user.id}:`, error);
    }
    return;
  }

  // If BOT_TOKEN is available, use Telegraf
  const bot = new Telegraf(BOT_TOKEN);
  try {
    await bot.telegram.sendMessage(
      user.telegramChatId,
      `Product Expiring Soon: ${product.name}\nExpiration Date: ${new Date(product.expirationDate).toLocaleDateString()}`
    );
    console.log(`Telegram notification sent to chat ID ${user.telegramChatId} for product ${product.name}`);
  } catch (error) {
    console.error(`Error sending Telegram notification via Telegraf for user ${user.id}:`, error);
  }
}

// Cron job to check for expiring products daily
export function setupNotificationCron() {
  // Schedule the job to run every day at a specific time (e.g., 8 AM UTC)
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily notification check...');

    try {
      // Fetch all users
      const users = await prisma.user.findMany({
        include: {
          products: true, // Assuming User has a relation to Product, which is not defined in schema. Will add to plan.
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day

      for (const user of users) {
        if (!user.products) continue; // Skip if user has no products

        for (const product of user.products) {
          const expirationDate = new Date(product.expirationDate);
          expirationDate.setHours(0, 0, 0, 0); // Normalize expiration date

          const notifyDate = new Date(expirationDate);
          notifyDate.setDate(expirationDate.getDate() - user.notifyDaysBefore);
          notifyDate.setHours(0, 0, 0, 0); // Normalize notification date

          // Check if today is the notification date
          if (today.getTime() === notifyDate.getTime()) {
            console.log(`Product ${product.name} (ID: ${product.id}) is due for notification for user ${user.id}.`);
            // Send email notification
            await sendEmailNotification(user, product);

            // Send Telegram notification
            await sendTelegramNotification(user, product);
          }
        }
      }
      console.log('Daily notification check completed.');
    } catch (error) {
      console.error('Error during daily notification check:', error);
    }
  }, {
    scheduled: true,
    timezone: "UTC", // Specify timezone for cron job
  });
}

// Example of how to call this function in your application startup
// setupNotificationCron();
