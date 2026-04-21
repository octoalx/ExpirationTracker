import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

async function checkAndSendEmails(userId?: string) {
  const users = await prisma.user.findMany({
    where: {
      id: userId,
      settings: {
        emailNotifications: true,
      },
    },
    include: {
      settings: {
        select: {
          notificationEmail: true,
          smtpHost: true,
          smtpUser: true,
          smtpPass: true,
          smtpPort: true,
          urgentThreshold: true,
          emailNotifications: true,
        },
      },
      products: true,
    },
  });

  for (const user of users) {
    if (
      !user.settings?.smtpHost ||
      !user.settings.smtpUser ||
      !user.settings.smtpPass
    ) {
      console.warn(`SMTP settings not configured for user ${user.email}`);
      continue;
    }

    const transporter = nodemailer.createTransport({
      host: user.settings.smtpHost,
      port: user.settings.smtpPort,
      secure: user.settings.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: user.settings.smtpUser,
        pass: user.settings.smtpPass,
      },
    });

    const urgentProducts = user.products.filter((p) => {
      if (!p.expiryDate) return false;
      const daysUntilExpiry =
        (new Date(p.expiryDate).getTime() - new Date().getTime()) /
        (1000 * 3600 * 24);
      return (
        daysUntilExpiry > 0 &&
        daysUntilExpiry <= (user.settings?.urgentThreshold ?? 7)
      );
    });

    if (urgentProducts.length > 0) {
      try {
        transporter.sendMail({
          from: `"Expiration Tracker" <${user.settings.smtpUser}>`,
          to: user.settings.notificationEmail || user.email,
          subject: "Urgent: Products Expiring Soon",
          html: `
            <p>Hello ${user.name || "there"},</p>
            <p>The following products are expiring soon:</p>
            <ul>
              ${urgentProducts
                .map(
                  (p) =>
                    `<li>${p.name} (expires on ${new Date(
                      p.expiryDate!,
                    ).toLocaleDateString()})</li>`,
                )
                .join("")}
            </ul>
          `,
        });
        console.log(
          `Email sent to ${user.settings.notificationEmail || user.email} for ${urgentProducts.length} urgent products.`,
        );
      } catch (error) {
        console.error(
          `Failed to send email to ${user.settings.notificationEmail || user.email}:`,
          error,
        );
      }
    }
  }
}

// For standalone execution, e.g., from a cron job
if (require.main === module) {
  checkAndSendEmails()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { checkAndSendEmails };
