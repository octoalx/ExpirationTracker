import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "../lib/prisma";

interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private config: SMTPConfig | null = null;

  initialize(config: SMTPConfig): void {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  isInitialized(): boolean {
    return this.transporter !== null;
  }

  async send(
    to: string,
    subject: string,
    html: string,
    userId?: string
  ): Promise<SendResult> {
    if (!this.transporter || !this.config) {
      return { success: false, error: "Email service not initialized" };
    }

    const logEntry = await this.logEmail({
      userId,
      to,
      subject,
      status: "QUEUED",
    });

    try {
      const result = await this.transporter.sendMail({
        from: `"ExpiTrack" <${this.config.from}>`,
        to,
        subject,
        html,
      });

      await this.updateEmailLog(logEntry.id, {
        status: "SENT",
        messageId: result.messageId || undefined,
        sentAt: new Date(),
      });

      return { success: true, messageId: result.messageId || undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.updateEmailLog(logEntry.id, {
        status: "FAILED",
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  async sendTestEmail(to: string, userId?: string): Promise<SendResult> {
    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #059669; margin-bottom: 16px;">📧 Тестовое письмо</h1>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Если вы видите это письмо, значит настройки SMTP работают корректно!
        </p>
        <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 24px 0; border-radius: 8px;">
          <p style="margin: 0; color: #065f46; font-size: 14px;">
            <strong>Отправлено:</strong> ${new Date().toLocaleString("ru-RU")}
          </p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          ExpiTrack — система отслеживания сроков годности
        </p>
      </div>
    `;

    return this.send(to, "📧 Тестовое письмо от ExpiTrack", html, userId);
  }

  private async logEmail(fields: {
    userId?: string;
    to: string;
    subject: string;
    status: string;
  }) {
    const logEntry = await prisma.emailLog.create({
      data: {
        userId: fields.userId || null,
        to: fields.to,
        subject: fields.subject,
        status: fields.status,
      },
    });

    // Keep only last 50 email logs
    const totalCount = await prisma.emailLog.count();
    if (totalCount > 50) {
      const toDelete = await prisma.emailLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: 50,
        select: { id: true },
      });
      if (toDelete.length > 0) {
        await prisma.emailLog.deleteMany({
          where: { id: { in: toDelete.map((l) => l.id) } },
        });
      }
    }

    return logEntry;
  }

  private async updateEmailLog(
    id: string,
    fields: {
      status: string;
      messageId?: string;
      error?: string;
      sentAt?: Date;
    }
  ) {
    return prisma.emailLog.update({
      where: { id },
      data: {
        status: fields.status,
        messageId: fields.messageId || null,
        error: fields.error || null,
        sentAt: fields.sentAt || null,
      },
    });
  }
}

export const emailService = new EmailService();
export type { SMTPConfig, SendResult };
