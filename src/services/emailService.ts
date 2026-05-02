import nodemailer from "nodemailer";
import { config } from "dotenv";
import { resolve } from "path";
import { prisma } from "@/lib/prisma";
import {
  getEmailTemplate,
  detectEmailClient,
  EmailTemplateType,
  SummaryEmailData,
  ExpirationEmailData,
} from "@/lib/email-templates";

// Load environment variables from project root
config({ path: resolve(process.cwd(), ".env") });

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateUsed?: EmailTemplateType;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: SmtpConfig | null = null;

  /**
   * Initialize email service with SMTP configuration
   */
  initialize(config: SmtpConfig): void {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });
  }

  /**
   * Check if email service is initialized
   */
  isInitialized(): boolean {
    return this.transporter !== null;
  }

  /**
   * Get SMTP configuration from environment variables
   */
  static getConfigFromEnv(): SmtpConfig | null {
    const enabled = process.env.ENABLE_EMAIL_NOTIFICATIONS === "true";
    
    console.log("[EmailService] ENV check:", {
      ENABLE_EMAIL_NOTIFICATIONS: process.env.ENABLE_EMAIL_NOTIFICATIONS,
      enabled,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER ? "***set***" : undefined,
      SMTP_PASS: process.env.SMTP_PASS ? "***set***" : undefined,
      SMTP_FROM: process.env.SMTP_FROM,
    });
    
    if (!enabled) {
      console.warn("[EmailService] Email notifications disabled (ENABLE_EMAIL_NOTIFICATIONS !== 'true')");
      return null;
    }

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !user || !pass || !from) {
      console.warn("[EmailService] SMTP configuration incomplete in environment variables");
      return null;
    }

    return { host, port, user, pass, from };
  }

  /**
   * Initialize from environment variables
   */
  initializeFromEnv(): boolean {
    const config = EmailService.getConfigFromEnv();
    if (config) {
      this.initialize(config);
      return true;
    }
    return false;
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      throw new Error("Email service not initialized");
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("[EmailService] SMTP verification failed:", error);
      return false;
    }
  }

  /**
   * Send email and log to database
   */
  async send(message: EmailMessage, userId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter || !this.config) {
      // Queue email if SMTP is not available
      await this.queueEmail(message, userId, "SMTP not configured");
      return { success: false, error: "Email service not initialized" };
    }

    try {
      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      // Log successful email
      await this.logEmail({
        userId,
        to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
        subject: message.subject,
        status: "SENT",
        messageId: result.messageId,
      });

      console.log(`[EmailService] Email sent: ${result.messageId}${message.templateUsed ? ` (template: ${message.templateUsed})` : ''}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Queue for retry
      await this.queueEmail(message, userId, errorMessage);
      
      console.error("[EmailService] Failed to send email:", error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Log email to database
   */
  private async logEmail(data: {
    userId?: string;
    to: string;
    subject: string;
    status: string;
    messageId?: string;
    error?: string;
    retryCount?: number;
  }): Promise<void> {
    try {
      await prisma.emailLog.create({
        data: {
          userId: data.userId,
          to: data.to,
          subject: data.subject,
          status: data.status as any,
          messageId: data.messageId,
          error: data.error,
          retryCount: data.retryCount || 0,
        },
      });
    } catch (error) {
      console.error("[EmailService] Failed to log email:", error);
    }
  }

  /**
   * Queue email for retry when SMTP is unavailable
   */
  private async queueEmail(message: EmailMessage, userId?: string, error?: string): Promise<void> {
    try {
      await prisma.emailLog.create({
        data: {
          userId,
          to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
          subject: message.subject,
          body: message.html,
          status: "QUEUED",
          error: error || "SMTP unavailable",
          retryCount: 0,
        },
      });
      console.log("[EmailService] Email queued for retry");
    } catch (err) {
      console.error("[EmailService] Failed to queue email:", err);
    }
  }

  /**
   * Process queued emails (retry failed/queued emails)
   */
  async processQueuedEmails(): Promise<{ processed: number; successful: number; failed: number }> {
    if (!this.transporter) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    const stats = { processed: 0, successful: 0, failed: 0 };

    try {
      const queuedEmails = await prisma.emailLog.findMany({
        where: {
          status: { in: ["QUEUED", "FAILED"] },
          retryCount: { lt: 5 }, // Max 5 retries
        },
        take: 10, // Process in batches
        orderBy: { createdAt: "asc" },
      });

      for (const email of queuedEmails) {
        stats.processed++;

        try {
          const result = await this.transporter.sendMail({
            from: this.config!.from,
            to: email.to,
            subject: email.subject,
            html: email.body || "",
          });

          await prisma.emailLog.update({
            where: { id: email.id },
            data: {
              status: "SENT",
              messageId: result.messageId,
              sentAt: new Date(),
              retryCount: { increment: 1 },
            },
          });

          stats.successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";

          await prisma.emailLog.update({
            where: { id: email.id },
            data: {
              status: "FAILED",
              error: errorMessage,
              retryCount: { increment: 1 },
            },
          });

          stats.failed++;
        }
      }
    } catch (error) {
      console.error("[EmailService] Error processing queued emails:", error);
    }

    return stats;
  }

  /**
   * Get email history for user
   */
  async getEmailHistory(userId?: string, limit: number = 50): Promise<any[]> {
    try {
      return await prisma.emailLog.findMany({
        where: userId ? { userId } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (error) {
      console.error("[EmailService] Failed to get email history:", error);
      return [];
    }
  }

  /**
   * Get email statistics
   */
  async getStatistics(userId?: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    queued: number;
  }> {
    try {
      const where = userId ? { userId } : {};

      const [total, sent, failed, queued] = await Promise.all([
        prisma.emailLog.count({ where }),
        prisma.emailLog.count({ where: { ...where, status: "SENT" } }),
        prisma.emailLog.count({ where: { ...where, status: "FAILED" } }),
        prisma.emailLog.count({ where: { ...where, status: "QUEUED" } }),
      ]);

      return { total, sent, failed, queued };
    } catch (error) {
      console.error("[EmailService] Failed to get statistics:", error);
      return { total: 0, sent: 0, failed: 0, queued: 0 };
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string, userId?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
            .success { color: #059669; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ExpiTrack - Тестовое уведомление</h1>
            </div>
            <div class="content">
              <p class="success">✅ Email уведомления настроены корректно!</p>
              <p>Если вы получили это письмо, значит SMTP настройки работают правильно.</p>
              <p>Теперь вы будете получать уведомления о товарах с истекающим сроком годности.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;" />
              <p style="font-size: 12px; color: #64748b;">
                ExpiTrack - система отслеживания сроков годности<br />
                Отправлено: ${new Date().toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.send(
      {
        to,
        subject: "ExpiTrack - Тестовое уведомление",
        html,
        text: "Email уведомления настроены корректно! Если вы получили это письмо, значит SMTP настройки работают правильно.",
      },
      userId
    );
  }

  /**
   * Send summary email with automatic template detection
   */
  async sendSummaryEmail(
    to: string,
    data: SummaryEmailData,
    options: {
      userId?: string;
      forceTemplate?: "modern" | "outlook" | "auto";
    } = {}
  ): Promise<{ success: boolean; messageId?: string; error?: string; templateUsed?: string }> {
    const { userId, forceTemplate = "auto" } = options;

    // Detect client and get appropriate template
    const detectedClient = detectEmailClient(to, undefined, forceTemplate === "auto" ? undefined : forceTemplate);
    const { html, text, templateUsed } = getEmailTemplate("summary", data, detectedClient, to);

    console.log(`[EmailService] Sending summary email to ${to} using ${templateUsed} template (detected: ${detectedClient})`);

    const result = await this.send(
      {
        to,
        subject: `📦 ExpiTrack — ${data.products.length} ${this.getProductWordForm(data.products.length)} требуют внимания`,
        html,
        text,
        templateUsed,
      },
      userId
    );

    return { ...result, templateUsed };
  }

  /**
   * Send single product expiration email with automatic template detection
   */
  async sendExpirationEmail(
    to: string,
    data: ExpirationEmailData & { appUrl?: string },
    options: {
      userId?: string;
      forceTemplate?: "modern" | "outlook" | "auto";
    } = {}
  ): Promise<{ success: boolean; messageId?: string; error?: string; templateUsed?: string }> {
    const { userId, forceTemplate = "auto" } = options;

    // Detect client and get appropriate template
    const detectedClient = detectEmailClient(to, undefined, forceTemplate === "auto" ? undefined : forceTemplate);
    const { html, text, templateUsed } = getEmailTemplate("expiration", data, detectedClient, to);

    const urgencyLabels: Record<string, string> = {
      expired: "ПРОСРОЧЕН",
      critical: "СРОЧНО",
      warning: "ВНИМАНИЕ",
      soon: "Скоро истекает",
      safe: "Информация",
    };

    console.log(`[EmailService] Sending expiration email to ${to} using ${templateUsed} template (detected: ${detectedClient})`);

    const result = await this.send(
      {
        to,
        subject: `📦 ExpiTrack — ${urgencyLabels[data.urgency]}: ${data.productName}`,
        html,
        text,
        templateUsed,
      },
      userId
    );

    return { ...result, templateUsed };
  }

  /**
   * Helper for product word form
   */
  private getProductWordForm(count: number): string {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return "товаров";
    if (lastDigit === 1) return "товар";
    if (lastDigit >= 2 && lastDigit <= 4) return "товара";
    return "товаров";
  }
}

// Export singleton instance
export const emailService = new EmailService();
