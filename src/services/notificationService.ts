import { prisma } from "@/lib/prisma";
import { emailService } from "./emailService";
import type { SmtpConfig } from "./emailService";

export interface ProductWithStatus {
  id: string;
  name: string;
  barcode: string;
  expiryDate: Date;
  status: string;
  userId: string;
  user?: {
    email: string | null;
    name: string | null;
    settings?: {
      notificationEmail: string | null;
      emailNotifications: boolean;
      notifyBeforeExpiration: number;
      smtpHost: string | null;
      smtpPort: number | null;
      smtpUser: string | null;
      smtpPass: string | null;
    } | null;
  } | null;
}

export interface NotificationResult {
  userId: string;
  email: string;
  productsNotified: number;
  success: boolean;
  error?: string;
  messageId?: string;
}

class NotificationService {
  /**
   * Find products nearing expiration that need notification
   */
  async findProductsForNotification(): Promise<ProductWithStatus[]> {
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE", // Only active products
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
            settings: {
              select: {
                notificationEmail: true,
                emailNotifications: true,
                notifyBeforeExpiration: true,
                smtpHost: true,
                smtpPort: true,
                smtpUser: true,
                smtpPass: true,
              },
            },
          },
        },
      },
    });

    // Filter products that need notification based on user settings
    return products.filter((product) => {
      const settings = product.user?.settings;
      if (!settings?.emailNotifications) return false;

      const notifyBeforeDays = settings.notifyBeforeExpiration || 3;
      const daysUntilExpiry = this.getDaysUntilExpiry(product.expiryDate);

      // Notify if product expires within the notification window
      // and hasn't expired yet
      return daysUntilExpiry <= notifyBeforeDays && daysUntilExpiry >= 0;
    });
  }

  /**
   * Calculate days until expiry
   */
  private getDaysUntilExpiry(expiryDate: Date): number {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Group products by user
   */
  private groupByUser(products: ProductWithStatus[]): Map<string, ProductWithStatus[]> {
    const grouped = new Map<string, ProductWithStatus[]>();

    for (const product of products) {
      const userId = product.userId;
      if (!grouped.has(userId)) {
        grouped.set(userId, []);
      }
      grouped.get(userId)!.push(product);
    }

    return grouped;
  }

  /**
   * Get notification email for user
   */
  private getNotificationEmail(product: ProductWithStatus): string | null {
    // Priority: user's notification email setting > user's account email
    const settingsEmail = product.user?.settings?.notificationEmail;
    const userEmail = product.user?.email;
    return settingsEmail || userEmail || null;
  }

  /**
   * Build SmtpConfig from user's DB settings
   */
  private getUserSmtpConfig(product: ProductWithStatus): SmtpConfig | null {
    const s = product.user?.settings;
    if (!s?.smtpHost || !s?.smtpUser || !s?.smtpPass) return null;
    return {
      host: s.smtpHost,
      port: s.smtpPort ?? 587,
      user: s.smtpUser,
      pass: s.smtpPass,
      from: `"ExpiTrack" <${s.smtpUser}>`,
    };
  }

  /**
   * Send expiration notifications to all users with products nearing expiry
   */
  async sendExpirationNotifications(): Promise<NotificationResult[]> {
    const products = await this.findProductsForNotification();
    if (products.length === 0) {
      console.log("[NotificationService] No products need notification");
      return [];
    }

    const groupedByUser = this.groupByUser(products);
    const results: NotificationResult[] = [];

    for (const [userId, userProducts] of groupedByUser) {
      const email = this.getNotificationEmail(userProducts[0]);

      if (!email) {
        console.warn(`[NotificationService] No email for user ${userId}`);
        continue;
      }

      // Use per-user SMTP from DB; fall back to ENV-based global service
      const smtpConfig = this.getUserSmtpConfig(userProducts[0]);
      if (smtpConfig) {
        emailService.initialize(smtpConfig);
      } else if (!emailService.isInitialized()) {
        const initialized = emailService.initializeFromEnv();
        if (!initialized) {
          console.warn(`[NotificationService] No SMTP config for user ${userId}`);
          results.push({ userId, email, productsNotified: userProducts.length, success: false, error: "SMTP not configured" });
          continue;
        }
      }

      try {
        // Send single email with all products for this user
        const result = await this.sendBatchNotification(email, userProducts);

        results.push({
          userId,
          email,
          productsNotified: userProducts.length,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          userId,
          email,
          productsNotified: userProducts.length,
          success: false,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * Send batch notification email for multiple products
   */
  private async sendBatchNotification(
    to: string,
    products: ProductWithStatus[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const userName = products[0].user?.name;
    
    // Calculate urgency for each product
    const productsWithUrgency = products.map((p) => {
      const daysUntil = this.getDaysUntilExpiry(p.expiryDate);
      let urgency: "expired" | "critical" | "warning" | "safe" = "safe";
      
      if (daysUntil < 0) {
        urgency = "expired";
      } else if (daysUntil <= 1) {
        urgency = "critical";
      } else if (daysUntil <= 3) {
        urgency = "warning";
      }

      return {
        ...p,
        daysUntil,
        urgency,
      };
    });

    // Sort by urgency and days
    productsWithUrgency.sort((a, b) => a.daysUntil - b.daysUntil);

    // Use sendSummaryEmail with auto-detection for Outlook
    return emailService.sendSummaryEmail(
      to,
      {
        userName: userName || undefined,
        products: productsWithUrgency.map((p) => ({
          name: p.name,
          barcode: p.barcode,
          expiryDate: p.expiryDate.toISOString().split("T")[0],
          daysUntil: p.daysUntil,
          urgency: p.urgency,
        })),
      },
      { userId: products[0].userId }
    );
  }

  /**
   * Send single product notification
   */
  async sendSingleProductNotification(
    to: string,
    product: ProductWithStatus,
    userId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!emailService.isInitialized()) {
      const initialized = emailService.initializeFromEnv();
      if (!initialized) {
        return { success: false, error: "Email service not configured" };
      }
    }

    const daysUntil = this.getDaysUntilExpiry(product.expiryDate);
    let urgency: "expired" | "critical" | "warning" | "safe" = "safe";
    
    if (daysUntil < 0) {
      urgency = "expired";
    } else if (daysUntil <= 1) {
      urgency = "critical";
    } else if (daysUntil <= 3) {
      urgency = "warning";
    }

    // Use sendExpirationEmail with auto-detection for Outlook
    return emailService.sendExpirationEmail(
      to,
      {
        productName: product.name,
        barcode: product.barcode,
        expiryDate: product.expiryDate.toISOString().split("T")[0],
        daysUntil,
        urgency,
      },
      { userId }
    );
  }

  /**
   * Generate plain text version of email
   */
  private generatePlainTextSummary(
    products: Array<ProductWithStatus & { daysUntil: number; urgency: string }>
  ): string {
    let text = "Уведомление о сроках годности товаров\n\n";
    
    for (const p of products) {
      const status = p.urgency === "expired" 
        ? "❌ ПРОСРОЧЕН" 
        : p.urgency === "critical" 
        ? "🚨 СРОЧНО" 
        : p.urgency === "warning" 
        ? "⚠️ ВНИМАНИЕ" 
        : "✅ ОК";
      
      text += `${status}\n`;
      text += `Товар: ${p.name}\n`;
      text += `Штрихкод: ${p.barcode}\n`;
      text += `Срок годности: ${p.expiryDate.toISOString().split("T")[0]}\n`;
      text += `Осталось: ${p.daysUntil} дн.\n\n`;
    }

    text += "---\nExpiTrack - система отслеживания сроков годности";
    return text;
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalActiveProducts: number;
    productsNeedingNotification: number;
    totalUsers: number;
    usersWithEnabledNotifications: number;
  }> {
    const [
      totalActiveProducts,
      totalUsers,
      usersWithEnabledNotifications,
    ] = await Promise.all([
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.settings.count({ where: { emailNotifications: true } }),
    ]);

    const products = await this.findProductsForNotification();
    const uniqueUsers = new Set(products.map((p) => p.userId));

    return {
      totalActiveProducts,
      productsNeedingNotification: products.length,
      totalUsers,
      usersWithEnabledNotifications,
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
