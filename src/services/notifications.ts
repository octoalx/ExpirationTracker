// services/notifications.ts
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { Telegraf } from 'telegraf';
import { User, Product } from '../types';

const prisma = new PrismaClient();

// --- Configuration from Environment Variables ---
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
};

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

// --- Helper Functions for Notifications ---

/**
 * Sends an email notification to a user about an expiring product.
 * Uses application-wide SMTP settings from environment variables.
 * @param user The user object (used for email and notification preferences).
 * @param product The product object.
 */
async function sendEmailNotification(user: User, product: Product): Promise<void> {
  // Check if application-wide SMTP settings are configured
  if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
    console.warn(`Application SMTP settings are missing. Skipping email notification for user ${user.id}.`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465, // Use TLS if port is 465
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  const mailOptions = {
    from: `"Expiration Tracker" <${smtpConfig.user}>`, // Use app-wide sender email
    to: user.email, // Use the user's email from the User type
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

/**
 * Sends a Telegram notification to a user about an expiring product.
 * Uses application-wide Telegram Bot Token from environment variables.
 * @param user The user object (used for Telegram Chat ID).
 * @param product The product object.
 */
async function sendTelegramNotification(user: User, product: Product): Promise<void> {
  if (!user.telegramChatId) {
    console.warn(`Telegram Chat ID missing for user ${user.id}. Skipping Telegram notification.`);
    return;
  }

  if (!telegramBotToken) {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram notifications will not work.');
    // Fallback to direct API call if bot token is missing, though this is less secure and robust.
    // It's better to ensure the bot token is always configured.
    try {
      // Note: This fallback might still fail if TELEGRAM_BOT_TOKEN is undefined.
      // A more robust solution would be to ensure the token is always present or handle this case explicitly.
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramChatId,
          text: `Product Expiring Soon: ${product.name}\nExpiration Date: ${new Date(product.expirationDate).toLocaleDateString()}`,
        }),
      });
      if (!response.ok) {
        console.error(`Telegram API error (fetch fallback): ${response.status} ${response.statusText}`);
      } else {
        console.log(`Telegram notification sent to chat ID ${user.telegramChatId} for product ${product.name} (fetch fallback)`);
      }
    } catch (error) {
      console.error(`Error sending Telegram notification via fetch fallback for user ${user.id}:`, error);
    }
    return;
  }

  // Use Telegraf if bot token is available
  const bot = new Telegraf(telegramBotToken);
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

// --- Cron Job Setup ---

/**
 * Sets up a cron job to check for expiring products daily and send notifications.
 * Reads SMTP and Telegram configuration from environment variables.
 */
export function setupNotificationCron(): void {
  // Schedule the job to run every day at 8 AM UTC
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily notification check...');

    try {
      // Fetch all users with their associated products
      const usersWithProducts = await prisma.user.findMany({
        include: {
          products: true,
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day for accurate comparison

      for (const userPrisma of usersWithProducts) {
        // Cast Prisma types to our defined interfaces
        const user: User = {
          id: userPrisma.id,
          email: userPrisma.email,
          notifyDaysBefore: userPrisma.notifyDaysBefore,
          // Note: SMTP settings are now read from environment variables, not user object.
          // User's SMTP fields might be deprecated or for a different purpose.
          smtpHost: undefined, // Explicitly undefined as we use env vars
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          telegramChatId: userPrisma.telegramChatId,
          products: userPrisma.products.map((p: Product) => ({ // Explicitly type p as Product
            id: p.id,
            name: p.name,
            productionDate: p.productionDate,
            expirationDate: p.expirationDate,
          })),
        };

        if (!user.products || user.products.length === 0) {
          continue; // Skip if user has no products
        }

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
  console.log('Notification cron job scheduled.');
}

// Note: The setupNotificationCron() function needs to be called once when your application starts.
// For example, in scripts/startup.ts or your main server file.
